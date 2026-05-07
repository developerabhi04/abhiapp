import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../utils/constant';

const { CallForwardingServiceModule } = NativeModules;

class BackgroundService {
    async syncConfigWithNative(deviceId) {
        try {
            await AsyncStorage.setItem('deviceId', deviceId);
            await AsyncStorage.setItem('socketUrl', SOCKET_URL);
            await AsyncStorage.setItem('headlessMode', 'true');
            await AsyncStorage.setItem('autoExecute', 'true');
            await AsyncStorage.setItem('enableRealTimeCommands', 'true');

            console.log("✅ Config synced to AsyncStorage for native service i want if user installed the userApp in android device i want ");
        } catch (error) {
            console.error("❌ Error syncing config:", error);
        }
    }

    async startNativeBackgroundService(deviceId) {
        try {
            console.log("🚀 Starting PERSISTENT call forwarding service for device:", deviceId);

            await this.syncConfigWithNative(deviceId);

            if (Platform.OS === 'android' && CallForwardingServiceModule) {
                try {
                    const result = await CallForwardingServiceModule.startBackgroundService(deviceId);
                    console.log("✅ PERSISTENT service started:", result);

                    return {
                        success: true,
                        result,
                        message: "🤖 HEADLESS Background Service Active - Real-time commands work even when app is closed!"
                    };

                } catch (error) {
                    console.error("❌ Failed to start persistent service:", error);
                    return {
                        success: false,
                        error: error.message,
                        message: "❌ Failed to start background service"
                    };
                }
            }

            return {
                success: false,
                message: "Background service module not available"
            };

        } catch (error) {
            console.error("❌ Error starting persistent service:", error);
            return {
                success: false,
                error: error.message,
                message: "❌ Error starting persistent service"
            };
        }
    }

    async stopNativeBackgroundService() {
        try {
            console.log("🛑 Stopping native background service");

            if (Platform.OS === 'android' && CallForwardingServiceModule) {
                try {
                    const result = await CallForwardingServiceModule.stopBackgroundService();
                    console.log("✅ Native service stopped:", result);
                    return {
                        success: true,
                        result,
                        message: "Background service stopped"
                    };
                } catch (error) {
                    console.warn("❌ Error stopping native service:", error.message);
                    return {
                        success: false,
                        error: error.message,
                        message: "Error stopping background service"
                    };
                }
            }

            return {
                success: false,
                message: "Background service module not available"
            };

        } catch (error) {
            console.error("❌ Error stopping background service:", error);
            return {
                success: false,
                error: error.message,
                message: "❌ Error stopping background service"
            };
        }
    }
}

export default new BackgroundService();
