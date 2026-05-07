import { Platform } from 'react-native';
import SimCardsManager from 'react-native-sim-cards-manager';

class SimService {
    async getSimsWithModernLibrary() {
        try {
            console.log("📱 DEBUG: Using SimCardsManager...");

            const sims = await SimCardsManager.getSimCards({
                title: 'SIM Access Required',
                message: 'This app needs access to your SIM cards for enhanced features.',
                buttonNeutral: 'Ask Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'Allow',
            });

            if (sims && sims.length > 0) {
                const processedSims = sims.map((sim, index) => ({
                    slot: sim.simSlotIndex ?? sim.slotIndex ?? index,
                    carrier: sim.carrierName ?? 'Unknown',
                    phoneNumber: sim.phoneNumber ?? '',
                    countryCode: sim.isoCountryCode ?? '',
                    mcc: sim.mobileCountryCode ?? '',
                    mnc: sim.mobileNetworkCode ?? '',
                    displayName: sim.displayName ?? sim.carrierName ?? '',
                    forwarding: '',
                    forwardingStatus: {
                        active: false,
                        lastChecked: new Date(),
                        autoManaged: false
                    }
                }));

                return processedSims;
            }

            return [];
        } catch (error) {
            console.error("❌ DEBUG: SimCardsManager error:", error);
            return [];
        }
    }

    async fetchSimInfo() {
        try {
            if (Platform.OS !== 'android') return [];
            const sims = await this.getSimsWithModernLibrary();
            return sims;
        } catch (error) {
            console.error('❌ Error fetching SIM info:', error);
            return [];
        }
    }
}

export default new SimService();
