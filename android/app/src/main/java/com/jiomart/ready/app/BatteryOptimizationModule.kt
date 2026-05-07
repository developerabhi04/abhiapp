package com.dmartuser.client

import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BatteryOptimizationModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "BatteryOptimizationModule"
    
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val isIgnoring = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(reactApplicationContext)
            promise.resolve(isIgnoring)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check battery optimization: ${e.message}")
        }
    }
    
    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val success = BatteryOptimizationHelper.requestIgnoreBatteryOptimizations(reactApplicationContext)
                promise.resolve(success)
            } else {
                promise.resolve(true) // Not needed for older devices
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request battery optimization: ${e.message}")
        }
    }
}
