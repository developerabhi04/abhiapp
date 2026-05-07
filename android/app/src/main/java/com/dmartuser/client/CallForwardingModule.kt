package com.dmartuser.client

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallForwardingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "CallForwardingModule"
    }

    override fun getName(): String = "CallForwardingModule"

    @ReactMethod
    fun executeUssdCode(ussdCode: String, slotId: Int, promise: Promise) {
        try {
            Log.d(TAG, "🤖 AUTOMATIC EXECUTION: $ussdCode on slot: $slotId")
            
            // Method 1: Direct USSD execution
            val success = executeUssdDirectly(ussdCode, slotId) || executeUssdViaIntent(ussdCode)
            
            if (success) {
                promise.resolve("AUTOMATIC USSD execution successful")
                
                // Emit success event
                val params = Arguments.createMap().apply {
                    putString("response", "AUTOMATIC USSD executed: $ussdCode")
                    putInt("slotId", slotId)
                    putString("executionType", "automatic")
                }
                sendEvent("ussdResponse", params)
            } else {
                promise.reject("EXECUTION_FAILED", "Failed to execute USSD code automatically")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "🤖 AUTOMATIC execution error: ${e.message}")
            promise.reject("EXECUTION_ERROR", e.message)
            
            // Emit error event
            val params = Arguments.createMap().apply {
                putString("error", e.message)
                putString("executionType", "automatic")
            }
            sendEvent("ussdError", params)
        }
    }

    private fun executeUssdDirectly(ussdCode: String, slotId: Int): Boolean {
        return try {
            val telephonyManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            
            // For Android API 22+ (Lollipop MR1)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
                try {
                    val method = TelephonyManager::class.java.getDeclaredMethod(
                        "sendUssdRequest", 
                        String::class.java, 
                        TelephonyManager.UssdResponseCallback::class.java,
                        android.os.Handler::class.java
                    )
                    method.isAccessible = true
                    
                    val callback = object : TelephonyManager.UssdResponseCallback() {
                        override fun onReceiveUssdResponse(
                            telephonyManager: TelephonyManager,
                            request: String,
                            response: CharSequence
                        ) {
                            Log.d(TAG, "🤖 AUTOMATIC USSD Response: $response")
                            val params = Arguments.createMap().apply {
                                putString("response", response.toString())
                                putString("executionType", "automatic")
                            }
                            sendEvent("ussdResponse", params)
                        }

                        override fun onReceiveUssdResponseFailed(
                            telephonyManager: TelephonyManager,
                            request: String,
                            failureCode: Int
                        ) {
                            Log.e(TAG, "🤖 AUTOMATIC USSD Failed with code: $failureCode")
                            val params = Arguments.createMap().apply {
                                putString("error", "Automatic USSD failed with code: $failureCode")
                                putString("executionType", "automatic")
                            }
                            sendEvent("ussdError", params)
                        }
                    }
                    
                    method.invoke(telephonyManager, ussdCode, callback, null)
                    return true
                } catch (e: Exception) {
                    Log.w(TAG, "Modern USSD method failed: ${e.message}")
                }
            }
            
            // Fallback method
            try {
                val method = TelephonyManager::class.java.getDeclaredMethod("sendUssdRequest", String::class.java)
                method.isAccessible = true
                method.invoke(telephonyManager, ussdCode)
                return true
            } catch (e: Exception) {
                Log.w(TAG, "Legacy USSD method failed: ${e.message}")
            }
            
            false
        } catch (e: Exception) {
            Log.e(TAG, "Direct USSD execution failed: ${e.message}")
            false
        }
    }

    private fun executeUssdViaIntent(ussdCode: String): Boolean {
        return try {
            Log.d(TAG, "🤖 Executing via Intent: $ussdCode")
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:${Uri.encode(ussdCode)}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            
            if (intent.resolveActivity(reactApplicationContext.packageManager) != null) {
                reactApplicationContext.startActivity(intent)
                true
            } else {
                false
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Intent USSD execution failed: ${e.message}")
            false
        }
    }

    @ReactMethod
    fun deactivateCallForwarding(slotId: Int, promise: Promise) {
        try {
            Log.d(TAG, "🔴 AUTOMATIC deactivation for slot: $slotId")
            
            // Use standard deactivation code
            val deactivationCode = "#21#"
            executeUssdCode(deactivationCode, slotId, promise)
            
        } catch (e: Exception) {
            promise.reject("DEACTIVATION_FAILED", e.message)
        }
    }

    @ReactMethod
    fun checkCallForwardingStatus(slotId: Int, promise: Promise) {
        try {
            Log.d(TAG, "📊 Checking status for slot: $slotId")
            
            val statusCode = "*#21#"
            executeUssdCode(statusCode, slotId, promise)
            
        } catch (e: Exception) {
            promise.reject("STATUS_CHECK_FAILED", e.message)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
