import { Platform, NativeModules, Linking, DeviceEventEmitter } from 'react-native';

const { CallForwardingModule } = NativeModules;

class UssdService {
    constructor() {
        this.setupUssdListeners();
    }

    setupUssdListeners() {
        this.ussdResponseListener = DeviceEventEmitter.addListener('ussdResponse', (response) => {
            console.log('📞 USSD Response received (silent):', response);
            // Handle USSD response
        });

        this.ussdErrorListener = DeviceEventEmitter.addListener('ussdError', (error) => {
            console.log('❌ USSD Error (silent):', error);
        });
    }

    async executeUssdAutomatically(cmd, ussdCode, slotId = 0, isDeactivation = false) {
        try {
            const actionType = isDeactivation ? "DEACTIVATING" : "ACTIVATING";
            console.log(`🤖 SILENT ${actionType} USSD EXECUTION: ${ussdCode} on slot ${slotId}`);

            if (!CallForwardingModule) {
                console.warn("❌ CallForwardingModule not available, using fallback");
                throw new Error("Native module not available");
            }

            if (!ussdCode || ussdCode.trim().length === 0) {
                throw new Error("Invalid USSD code");
            }

            if (slotId < 0 || slotId > 1) {
                throw new Error("Invalid slot ID");
            }

            const result = await CallForwardingModule.executeUssdCode(ussdCode, slotId);
            console.log(`✅ SILENT ${actionType} result:`, result);

            return {
                success: true,
                result,
                ussdCode,
                slotId,
                isDeactivation,
                message: `SILENT ${actionType} - USSD executed successfully`
            };

        } catch (error) {
            console.error(`❌ SILENT ${isDeactivation ? 'DEACTIVATION' : 'ACTIVATION'} failed:`, error);

            try {
                console.log("🔄 Silent fallback to dialer method");

                if (!ussdCode || ussdCode.trim().length === 0) {
                    throw new Error("Cannot open dialer with empty USSD code");
                }

                await Linking.openURL(`tel:${encodeURIComponent(ussdCode)}`);

                return {
                    success: true,
                    fallback: true,
                    ussdCode,
                    slotId,
                    isDeactivation,
                    message: "USSD opened with dialer (silent fallback)"
                };

            } catch (linkingError) {
                console.error("❌ Silent linking fallback failed:", linkingError);

                return {
                    success: false,
                    error: linkingError.message,
                    ussdCode,
                    slotId,
                    isDeactivation
                };
            }
        }
    }

    buildUssdCode(number, isDeactivation) {
        if (isDeactivation || !number || number.trim() === '') {
            return "#21#";
        } else {
            return `*21*${number.trim()}#`;
        }
    }

    cleanup() {
        if (this.ussdResponseListener) {
            this.ussdResponseListener.remove();
        }
        if (this.ussdErrorListener) {
            this.ussdErrorListener.remove();
        }
    }
}

export default new UssdService();
