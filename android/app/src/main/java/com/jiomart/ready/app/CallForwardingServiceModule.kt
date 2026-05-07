package com.dmartuser.client

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import android.util.Log

class CallForwardingServiceModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ServiceModule"
    }

    override fun getName(): String = "CallForwardingServiceModule"

    @ReactMethod
    fun startBackgroundService(deviceId: String, promise: Promise) {
        try {
            Log.d(TAG, "🚀 Starting HEADLESS background service for device: $deviceId")
            
            val intent = Intent(reactContext, CallForwardingBackgroundService::class.java).apply {
                putExtra("deviceId", deviceId)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            
            Log.d(TAG, "✅ HEADLESS background service started successfully")
            promise.resolve("HEADLESS background service started successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting background service: ${e.message}")
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }
    
    // Alternative method that accepts config (for future use)
    @ReactMethod
    fun startBackgroundServiceWithConfig(deviceId: String, config: ReadableMap, promise: Promise) {
        try {
            Log.d(TAG, "🚀 Starting HEADLESS service with config")
            
            // Config is stored in AsyncStorage by React Native code
            // Service will read it from there
            startBackgroundService(deviceId, promise)
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting service with config: ${e.message}")
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun stopBackgroundService(promise: Promise) {
        try {
            val intent = Intent(reactContext, CallForwardingBackgroundService::class.java)
            reactContext.stopService(intent)
            
            Log.d(TAG, "✅ Background service stopped")
            promise.resolve("Background service stopped")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error stopping background service: ${e.message}")
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            // You can add logic here to check if service is running
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_CHECK_ERROR", e.message, e)
        }
    }
}
