package com.dmartuser.client

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CallForwardingPackage : ReactPackage {
    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            CallForwardingModule(reactContext),
            CallForwardingServiceModule(reactContext),
            BatteryOptimizationModule(reactContext),
            SmsSendingModule(reactContext)
        )
    }
}
