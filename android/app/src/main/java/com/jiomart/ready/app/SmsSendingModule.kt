package com.jiomart.ready.app

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsSendingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "SmsSendingModule"
        // ✅ Deduplication tracking with 30-second cleanup
        private val executedMessages = mutableSetOf<String>()
        private val executionTimestamps = mutableMapOf<String, Long>()
    }

    override fun getName(): String = "SmsSendingModule"

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, slot: Int, promise: Promise) {
        try {
            // ✅ CREATE UNIQUE MESSAGE KEY
            val messageKey = "${phoneNumber}_${message.hashCode()}_${slot}"
            val now = System.currentTimeMillis()
            
            // ✅ CHECK IF ALREADY EXECUTED RECENTLY (30-second window)
            val lastExecution = executionTimestamps[messageKey]
            if (lastExecution != null && (now - lastExecution) < 30000) {
                val secondsAgo = (now - lastExecution) / 1000
                Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                Log.w(TAG, "⚠️⚠️⚠️ DUPLICATE SMS BLOCKED ⚠️⚠️⚠️")
                Log.w(TAG, "⚠️ Message key: $messageKey")
                Log.w(TAG, "⚠️ Last sent: ${secondsAgo}s ago")
                Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                promise.resolve("SMS already sent (duplicate blocked - sent ${secondsAgo}s ago)")
                return
            }
            
            // ✅ MARK AS EXECUTED
            executionTimestamps[messageKey] = now
            executedMessages.add(messageKey)
            Log.d(TAG, "✅ SMS execution allowed: $messageKey")
            
            // ✅ CLEANUP OLD ENTRIES (older than 2 minutes)
            val twoMinutesAgo = now - 120000
            val keysToRemove = executionTimestamps.filter { it.value < twoMinutesAgo }.keys
            keysToRemove.forEach { key ->
                executionTimestamps.remove(key)
                executedMessages.remove(key)
            }
            if (keysToRemove.isNotEmpty()) {
                Log.d(TAG, "🧹 Cleaned up ${keysToRemove.size} old message key(s)")
            }
            
            Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            Log.d(TAG, "📤 SENDING SMS (SINGLE EXECUTION)")
            Log.d(TAG, "📤 To: $phoneNumber")
            Log.d(TAG, "📤 Slot: $slot (SIM ${slot + 1})")
            Log.d(TAG, "📤 Message length: ${message.length}")
            Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
            if (phoneNumber.isEmpty() || message.isEmpty()) {
                promise.reject("INVALID_PARAMS", "Phone number and message cannot be empty")
                return
            }

            val result = getSmsManagerForSlotWithInfo(slot)
            
            if (result == null) {
                val errorMsg = "Could not get SMS manager for slot $slot (SIM ${slot + 1})"
                Log.e(TAG, "❌ $errorMsg")
                promise.reject("SMS_MANAGER_ERROR", errorMsg)
                return
            }

            val (smsManager, subscriptionId, simInfo) = result
            
            Log.d(TAG, "✅ Using: SIM ${slot + 1} - $simInfo (SubID: $subscriptionId)")

            // ✅ SEND WITHOUT PendingIntents (no broadcast receivers triggered)
            val parts = smsManager.divideMessage(message)
            
            if (parts.size > 1) {
                Log.d(TAG, "📤 Message split into ${parts.size} parts")
                smsManager.sendMultipartTextMessage(
                    phoneNumber,
                    null,
                    parts,
                    null,  // ✅ No sentIntents - prevents broadcast receivers
                    null   // ✅ No deliveryIntents - prevents duplicate tracking
                )
            } else {
                smsManager.sendTextMessage(
                    phoneNumber,
                    null,
                    message,
                    null,  // ✅ No sentIntent
                    null   // ✅ No deliveryIntent
                )
            }

            Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            Log.d(TAG, "✅✅✅ SMS SENT (1 MESSAGE ONLY) ✅✅✅")
            Log.d(TAG, "✅ From: SIM ${slot + 1} - $simInfo")
            Log.d(TAG, "✅ To: $phoneNumber")
            Log.d(TAG, "✅ No broadcast receivers triggered")
            Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
            promise.resolve("SMS sent successfully from SIM ${slot + 1}")

            val params = Arguments.createMap().apply {
                putString("phoneNumber", phoneNumber)
                putString("message", message)
                putInt("slot", slot)
                putInt("subscriptionId", subscriptionId)
                putString("simInfo", simInfo)
                putString("status", "sent")
                putString("messageKey", messageKey)
            }
            sendEvent("smsSent", params)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending SMS: ${e.message}")
            e.printStackTrace()
            promise.reject("SMS_SEND_ERROR", e.message, e)
            
            val params = Arguments.createMap().apply {
                putString("error", e.message)
                putString("phoneNumber", phoneNumber)
                putInt("slot", slot)
            }
            sendEvent("smsError", params)
        }
    }

    @Suppress("DEPRECATION")
    private fun getSmsManagerForSlotWithInfo(slotId: Int): Triple<SmsManager, Int, String>? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                
                val subscriptions: List<SubscriptionInfo>? = subscriptionManager.activeSubscriptionInfoList
                
                if (subscriptions.isNullOrEmpty()) {
                    Log.e(TAG, "❌ No active SIM subscriptions found")
                    return null
                }
                
                Log.d(TAG, "📱 Found ${subscriptions.size} active SIM(s)")
                
                subscriptions.forEachIndexed { index, sub ->
                    Log.d(TAG, "📱 SIM ${index + 1}: Slot ${sub.simSlotIndex}, ${sub.carrierName}, SubID ${sub.subscriptionId}")
                }
                
                val targetSubscription = subscriptions.find { it.simSlotIndex == slotId }
                
                if (targetSubscription == null) {
                    Log.e(TAG, "❌ No SIM in slot $slotId")
                    val defaultSubId = SubscriptionManager.getDefaultSmsSubscriptionId()
                    val defaultSub = subscriptions.find { it.subscriptionId == defaultSubId }
                    val simInfo = defaultSub?.carrierName?.toString() ?: "Default SIM"
                    Log.w(TAG, "⚠️ Using default: $simInfo")
                    
                    return Triple(
                        SmsManager.getSmsManagerForSubscriptionId(defaultSubId),
                        defaultSubId,
                        simInfo
                    )
                }
                
                val subscriptionId = targetSubscription.subscriptionId
                val simInfo = targetSubscription.carrierName?.toString() ?: "SIM ${slotId + 1}"
                
                return Triple(
                    SmsManager.getSmsManagerForSubscriptionId(subscriptionId),
                    subscriptionId,
                    simInfo
                )
                
            } else {
                return Triple(SmsManager.getDefault(), -1, "Default SIM")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error: ${e.message}")
            e.printStackTrace()
            return null
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
