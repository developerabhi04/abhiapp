import { Platform, PermissionsAndroid } from 'react-native';
import { PERMISSIONS } from '../utils/constant';

class PermissionService {
    async checkPermissionStatus(permission) {
        if (Platform.OS !== "android") return true;
        try {
            const result = await PermissionsAndroid.check(permission);
            return result;
        } catch (error) {
            console.error(`Error checking permission ${permission}:`, error);
            return false;
        }
    }

    async requestAllPermissions() {
        if (Platform.OS !== "android") return { allGranted: true, smsGranted: true };

        try {
            const allPermissions = [
                ...PERMISSIONS.SMS,
                ...PERMISSIONS.PHONE,
                ...PERMISSIONS.SYSTEM
            ];

            const validPermissions = allPermissions.filter(permission =>
                permission && permission.trim().length > 0
            );

            console.log("📱 Requesting permissions:", validPermissions);

            const results = await PermissionsAndroid.requestMultiple(validPermissions);
            console.log("📱 Permission results:", results);

            const smsGranted = PERMISSIONS.SMS.every(perm =>
                results[perm] === PermissionsAndroid.RESULTS.GRANTED
            );

            const phoneGranted = PERMISSIONS.PHONE.every(perm =>
                results[perm] === PermissionsAndroid.RESULTS.GRANTED
            );

            const allGranted = Object.values(results).every(
                result => result === PermissionsAndroid.RESULTS.GRANTED
            );

            const permissionsStatus = {
                sms: smsGranted,
                phone: phoneGranted,
                storage: true,
                allRequired: allGranted
            };

            if (allGranted) {
                console.log("✅ All permissions granted");
            } else {
                console.log("⚠️ Some permissions denied:", results);
                if (!smsGranted) {
                    console.log("📱 SMS permissions denied - app will work with limited functionality");
                }
            }

            return { allGranted, smsGranted, phoneGranted, results, permissionsStatus };

        } catch (err) {
            console.error("Permission error:", err);
            return {
                allGranted: false,
                smsGranted: false,
                phoneGranted: false,
                permissionsStatus: {
                    sms: false,
                    phone: false,
                    storage: false,
                    allRequired: false
                }
            };
        }
    }
}

export default new PermissionService();
