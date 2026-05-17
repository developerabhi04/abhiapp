import { Platform, NativeModules } from 'react-native';

const { BatteryOptimizationModule } = NativeModules;

class BatteryOptimizationService {
    async isIgnoringBatteryOptimizations() {
        try {
            if (Platform.OS !== 'android') return true;

            if (!BatteryOptimizationModule) {
                console.warn("⚠️ BatteryOptimizationModule not available");
                return true;
            }

            const isIgnoring = await BatteryOptimizationModule.isIgnoringBatteryOptimizations();
            console.log("🔋 Battery optimization ignored:", isIgnoring);
            return isIgnoring;
        } catch (error) {
            console.error("❌ Error checking battery optimization:", error);
            return false;
        }
    }

    async requestIgnoreBatteryOptimizations() {
        try {
            if (Platform.OS !== 'android') return { success: true };

            if (!BatteryOptimizationModule) {
                console.warn("⚠️ BatteryOptimizationModule not available");
                return { success: false, error: "Module not available" };
            }

            console.log("🔋 Requesting battery optimization exemption...");
            const success = await BatteryOptimizationModule.requestIgnoreBatteryOptimizations();

            return {
                success,
                message: success
                    ? "Battery optimization settings opened"
                    : "Failed to open battery settings"
            };
        } catch (error) {
            console.error("❌ Error requesting battery optimization:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new BatteryOptimizationService();
