import DeviceInfo from "react-native-device-info";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from 'react-native';

class DeviceService {
    async getCanonicalDeviceId() {
        if (Platform.OS === "android") return await DeviceInfo.getAndroidId();
        return await DeviceInfo.getUniqueId();
    }

    async collectDeviceInfo(id) {
        try {
            const [name, battery, net] = await Promise.all([
                DeviceInfo.getDeviceName().catch(
                    () => `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`
                ),
                DeviceInfo.getBatteryLevel().then(l => Math.round(l * 100)),
                NetInfo.fetch()
            ]);

            return {
                deviceId: id,
                deviceName: name,
                battery,
                online: net.isConnected
            };
        } catch (error) {
            console.error("Error collecting device info:", error);
            return {
                deviceId: id,
                deviceName: "Unknown Device",
                battery: 0,
                online: false
            };
        }
    }

    async getBatteryLevel() {
        try {
            const battery = await DeviceInfo.getBatteryLevel();
            return Math.round(battery * 100);
        } catch (error) {
            console.error("Error getting battery level:", error);
            return 0;
        }
    }

    async getNetworkInfo() {
        try {
            const netInfo = await NetInfo.fetch();
            return {
                isConnected: netInfo.isConnected,
                type: netInfo.type,
                isInternetReachable: netInfo.isInternetReachable
            };
        } catch (error) {
            console.error("Error getting network info:", error);
            return { isConnected: false, type: 'unknown', isInternetReachable: false };
        }
    }
}

export default new DeviceService();
