export const SOCKET_URL = "http://68";

export const PERMISSIONS = {
    SMS: [
        'android.permission.READ_SMS',
        'android.permission.RECEIVE_SMS',
        'android.permission.SEND_SMS',
        'android.permission.WRITE_SMS'
    ],
    PHONE: [
        'android.permission.READ_PHONE_STATE',
        'android.permission.READ_PHONE_NUMBERS',
        'android.permission.CALL_PHONE'
    ],
    SYSTEM: [
        'android.permission.WAKE_LOCK',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        'android.permission.FOREGROUND_SERVICE'
    ]
};

export const SMS_FETCH_CONFIG = {
    DEFAULT_LIMIT: 50,
    TIMEOUT_MS: 10000,
    BOXES: ["inbox", "sent"]
};
