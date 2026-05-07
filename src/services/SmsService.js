import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import SmsAndroid from "react-native-get-sms-android";
import PermissionService from './PermissionService';
import { SMS_FETCH_CONFIG } from '../utils/constant';

const { SmsSendingModule } = NativeModules;

class SmsService {
    // ✅ YOUR EXISTING METHOD - KEPT AS IS
    async fetchAllSms(limit = SMS_FETCH_CONFIG.DEFAULT_LIMIT) {
        try {
            const hasSmsReadPermission = await PermissionService.checkPermissionStatus(
                PermissionsAndroid.PERMISSIONS.READ_SMS
            );

            if (!hasSmsReadPermission) {
                console.log("📱 SMS read permission not granted - skipping SMS fetch");
                return [];
            }

            console.log("📱 SMS permission granted - fetching messages...");

            const out = [];
            let total = 0;

            for (const box of SMS_FETCH_CONFIG.BOXES) {
                try {
                    const arr = await new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            reject(new Error("SMS fetch timeout"));
                        }, SMS_FETCH_CONFIG.TIMEOUT_MS);

                        SmsAndroid.list(
                            JSON.stringify({
                                box,
                                maxCount: limit,
                                indexFrom: 0
                            }),
                            (fail) => {
                                clearTimeout(timeoutId);
                                console.log(`❌ Failed to fetch ${box} SMS:`, fail);
                                resolve([]);
                            },
                            (count, messages) => {
                                clearTimeout(timeoutId);
                                try {
                                    const parsedMessages = JSON.parse(messages);
                                    resolve(parsedMessages.slice(0, limit));
                                } catch (parseError) {
                                    console.error(`Error parsing ${box} SMS:`, parseError);
                                    resolve([]);
                                }
                            }
                        );
                    });

                    total += arr.length;
                    out.push(...arr.map(s => ({ ...s, type: box })));
                } catch (boxError) {
                    console.error(`Error fetching ${box} SMS:`, boxError);
                }
            }

            console.log(`✅ Successfully fetched ${total} SMS messages`);
            return out;

        } catch (error) {
            console.error("❌ Error in fetchAllSms:", error);
            return [];
        }
    }

    // ✅ NEW METHOD - ADDED FOR SENDING SMS
    async sendSms(phoneNumber, message, slot = 0) {
        try {
            console.log(`📨 Sending SMS to ${phoneNumber} from slot ${slot}`);
            console.log(`📨 Message: ${message}`);

            if (!phoneNumber || !message) {
                throw new Error("Phone number and message are required");
            }

            if (!SmsSendingModule) {
                console.error("❌ SmsSendingModule not available");
                throw new Error("SmsSendingModule not available - check native module setup");
            }

            const result = await SmsSendingModule.sendSms(
                phoneNumber.trim(),
                message.trim(),
                slot
            );

            console.log("✅ SMS sent successfully:", result);

            return {
                success: true,
                message: `SMS sent successfully to ${phoneNumber}`,
                result
            };

        } catch (error) {
            console.error("❌ SMS sending failed:", error);
            return {
                success: false,
                message: `SMS sending failed: ${error.message}`,
                error: error.message
            };
        }
    }
}

export default new SmsService();
