package com.dmartuser.client

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

class ServiceRestartWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        return try {
            Log.d("ServiceRestartWorker", "Restarting SMS monitoring service")
            
            val serviceIntent = Intent(applicationContext, SmsMonitoringService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(serviceIntent)
            } else {
                applicationContext.startService(serviceIntent)
            }
            
            Result.success()
        } catch (e: Exception) {
            Log.e("ServiceRestartWorker", "Service restart failed: ${e.message}")
            Result.failure()
        }
    }
}
