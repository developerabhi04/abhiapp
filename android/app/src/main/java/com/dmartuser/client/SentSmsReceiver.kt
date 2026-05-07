package com.dmartuser.client

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * This receiver is registered in AndroidManifest but does NOTHING
 * to prevent duplicate SMS handling
 */
class SentSmsReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "SentSmsReceiver"
    }
    
    override fun onReceive(context: Context?, intent: Intent?) {
        // ✅ DO NOTHING - just log for debugging
        // SmsSendingModule sends SMS without PendingIntents anyway
        Log.d(TAG, "📨 Sent SMS broadcast received (ignored to prevent duplicates)")
        
        when (resultCode) {
            Activity.RESULT_OK -> Log.d(TAG, "✅ SMS delivery confirmed")
            else -> Log.w(TAG, "⚠️ SMS delivery status: $resultCode")
        }
        
        // ✅ DO NOT process, sync, or handle - this prevents duplicates
    }
}
