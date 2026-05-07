package com.dmartuser.client

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.annotation.RequiresApi

object BatteryOptimizationHelper {
    private const val TAG = "BatteryOptimization"
    
    /**
     * Check if battery optimization is ignored for this app
     */
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoring = powerManager.isIgnoringBatteryOptimizations(context.packageName)
            Log.d(TAG, "Battery optimization ignored: $isIgnoring")
            isIgnoring
        } else {
            Log.d(TAG, "Device below Android M - no battery optimization")
            true // No battery optimization on older Android versions
        }
    }
    
    /**
     * Open battery optimization settings for this app
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun requestIgnoreBatteryOptimizations(context: Context): Boolean {
        return try {
            Log.d(TAG, "Opening battery optimization settings...")
            
            val intent = Intent().apply {
                action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            
            context.startActivity(intent)
            Log.d(TAG, "✅ Battery optimization settings opened")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open battery optimization settings: ${e.message}")
            // Fallback: Open app details settings
            openAppDetailsSettings(context)
            false
        }
    }
    
    /**
     * Fallback: Open app details settings where user can manually navigate to battery
     */
    private fun openAppDetailsSettings(context: Context): Boolean {
        return try {
            val intent = Intent().apply {
                action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            
            context.startActivity(intent)
            Log.d(TAG, "✅ App details settings opened as fallback")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open app details: ${e.message}")
            false
        }
    }
}
