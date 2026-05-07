# ✅ Aggressive optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose
-allowaccessmodification
-repackageclasses ''
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# ✅ Remove ALL logging in production (saves significant space)
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
    public static *** wtf(...);
}

# ✅ Keep attributes for debugging
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ✅ React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.fbreact.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-dontwarn com.facebook.react.**

# ✅ Hermes
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# ✅ Socket.IO
-keep class io.socket.** { *; }
-dontwarn io.socket.**
-keep class org.java_websocket.** { *; }
-dontwarn org.java_websocket.**

# ✅ OkHttp & Okio
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**

# ✅ JSON
-keep class org.json.** { *; }
-dontwarn org.json.**

# ✅ Your native modules
-keep class com.reactnativeandroidsmslistener.** { *; }
-keep class com.devicesettings.** { *; }
-keep class com.jiomart.ready.app.** { *; }

# ✅ AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# ✅ Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ✅ Keep view constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# ✅ Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ✅ Keep Parcelables
-keep class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator *;
}

# ✅ Keep Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
