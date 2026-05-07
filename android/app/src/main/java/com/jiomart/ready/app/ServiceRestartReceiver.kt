package com.dmartuser.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class ServiceRestartReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "ServiceRestartReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        val action = intent.action
        Log.d(TAG, "📡 Service restart receiver triggered: $action")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_RESTARTED,
            "com.dmartuser.client.RESTART_SERVICE" -> {
                Log.d(TAG, "🔄 Starting call forwarding service")
                startCallForwardingService(context)
            }
        }
    }

    private fun startCallForwardingService(context: Context) {
        try {
            val serviceIntent = Intent(context, CallForwardingBackgroundService::class.java)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            Log.d(TAG, "✅ Call forwarding service restarted")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting service: ${e.message}")
        }
    }
}
