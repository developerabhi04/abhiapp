package com.dmartuser.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import android.provider.Settings

class CallForwardingBootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "CallForwardingBootReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        val action = intent.action
        Log.d(TAG, "📱 Boot receiver triggered: $action")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_RESTARTED -> {
                Log.d(TAG, "🔄 Starting INDEPENDENT call forwarding service")
                startPersistentService(context)
            }
            
            // Handle service restart requests
            "com.dmartuser.client.RESTART_SERVICE" -> {
                Log.d(TAG, "🔄 Service restart requested")
                startPersistentService(context)
            }
        }
    }

    private fun startPersistentService(context: Context) {
        try {
            val deviceId = getStoredDeviceId(context)
            
            val serviceIntent = Intent(context, CallForwardingBackgroundService::class.java).apply {
                putExtra("deviceId", deviceId)
                flags = Intent.FLAG_INCLUDE_STOPPED_PACKAGES
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            Log.d(TAG, "✅ INDEPENDENT call forwarding service started - WORKS WHEN APP IS CLOSED!")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting persistent service: ${e.message}")
        }
    }

    private fun getStoredDeviceId(context: Context): String {
        return try {
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            ) ?: "unknown_device"
        } catch (e: Exception) {
            "unknown_device"
        }
    }
}
