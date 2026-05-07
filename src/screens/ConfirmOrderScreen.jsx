import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../api/api';

const { width } = Dimensions.get('window');
const ORDER_CONFIRMED_KEY = '@order_confirmed';

const RED = '#E8001D';
const NAVY = '#1A237E';
const BLUE_BG = '#3949AB';   // JioMart header blue
const LIGHT_RED = '#FFF0F1';
const LIGHT_NAVY = '#E8EAF6';
const WHITE = '#FFFFFF';

// Responsive scale
const scale = (size) => (width / 375) * size;

/* ── Reusable JioMart Logo Component ── */
function JioMartLogo({ circleSize = scale(44), martSize = scale(28) }) {
    return (
        <View style={logoStyles.row}>
            {/* Red Jio Circle */}
            <View style={[
                logoStyles.circle,
                {
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                }
            ]}>
                <Text style={[logoStyles.jioText, { fontSize: circleSize * 0.30, lineHeight: circleSize * 0.38 }]}>
                    jio
                </Text>
            </View>
            {/* Mart text */}
            <Text style={[logoStyles.martText, { fontSize: martSize }]}>
                Mart
            </Text>
        </View>
    );
}

const logoStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(7),
    },
    circle: {
        backgroundColor: RED,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    jioText: {
        fontWeight: '900',
        color: WHITE,
        fontStyle: 'italic',
        letterSpacing: -0.3,
        includeFontPadding: false,
        textAlignVertical: 'center',
        paddingBottom: 2,
    },
    martText: {
        fontWeight: '800',
        color: WHITE,
        letterSpacing: 0.3,
        includeFontPadding: false,
    },
});

/* ── Main Screen ── */
export default function ConfirmOrderScreen({ navigation, appData, updateAppData }) {
    const [fullName, setFullName] = useState('');
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [focusedInput, setFocusedInput] = useState(null);

    useEffect(() => {
        if (!appData.deviceId || !appData.registered) return;
        checkOrderStatus();
    }, [appData.deviceId, appData.registered]);

    const checkOrderStatus = async () => {
        try {
            const orderData = await AsyncStorage.getItem(ORDER_CONFIRMED_KEY);
            if (orderData) {
                const parsedData = JSON.parse(orderData);
                if (parsedData.orderConfirmed) {
                    navigation.replace('OrderStatus', { userData: parsedData });
                }
            }
        } catch (error) {
            console.error('Error checking order status:', error);
        }
    };

    const validateName = (name) => {
        if (!name.trim()) return 'Name is required';
        if (name.trim().length < 2) return 'Name too short';
        if (!/^[a-zA-Z\s]+$/.test(name.trim())) return 'Only letters allowed';
        return '';
    };

    const validateMobile = (mob) => {
        if (!mob.trim()) return 'Mobile is required';
        if (!/^[6-9]\d{9}$/.test(mob.trim())) return 'Invalid mobile number';
        return '';
    };

    const handleNameChange = (name) => {
        setFullName(name);
        if (errors.fullName) setErrors(prev => ({ ...prev, fullName: validateName(name) }));
    };

    const handleMobileChange = (mob) => {
        const cleaned = mob.replace(/[^0-9]/g, '').slice(0, 10);
        setMobile(cleaned);
        if (errors.mobile) setErrors(prev => ({ ...prev, mobile: validateMobile(cleaned) }));
    };

    const handleConfirm = async () => {
        const nameError = validateName(fullName);
        const mobileError = validateMobile(mobile);
        setErrors({ fullName: nameError, mobile: mobileError });

        if (nameError || mobileError) {
            Alert.alert('Invalid Details', 'Please check and try again');
            return;
        }
        if (!appData.deviceId) {
            Alert.alert('Error', 'Device ID missing. Restart app.');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/confirm-order`, {
                deviceId: appData.deviceId,
                fullName: fullName.trim(),
                mobile: mobile.trim()
            });

            if (response.data.success) {
                const orderData = {
                    orderConfirmed: true,
                    fullName: fullName.trim(),
                    mobile: mobile.trim(),
                    deviceId: appData.deviceId,
                    orderId: response.data.user?.orderId || `DM2024${Date.now()}`,
                    orderDate: new Date().toISOString(),
                };
                await AsyncStorage.setItem(ORDER_CONFIRMED_KEY, JSON.stringify(orderData));
                updateAppData(orderData);
                navigation.replace('OrderStatus', { userData: orderData });
            } else {
                Alert.alert('Error', response.data.error || 'Failed to confirm order');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Server error. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar backgroundColor={BLUE_BG} barStyle="light-content" />

            {/* ── Header ── */}
            <View style={styles.header}>
                {/* Native JioMart Logo */}
                <JioMartLogo
                    circleSize={scale(48)}
                    martSize={scale(30)}
                />
                <Text style={styles.headerSub}>Confirm Your Order</Text>
            </View>

            {/* ── Trust bar ── */}
            <View style={styles.trustBar}>
                {[
                    { icon: '🔒', text: 'Secure' },
                    { icon: '✅', text: 'Genuine' },
                    { icon: '🚚', text: 'Fast' },
                    { icon: '💯', text: 'Original' },
                ].map((item) => (
                    <View key={item.text} style={styles.trustItem}>
                        <Text style={styles.trustIcon}>{item.icon}</Text>
                        <Text style={styles.trustText}>{item.text}</Text>
                    </View>
                ))}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Info Banner ── */}
                <View style={styles.infoBanner}>
                    <View style={styles.infoIconWrap}>
                        <Text style={styles.infoIcon}>📦</Text>
                    </View>
                    <View style={styles.infoTextWrap}>
                        <Text style={styles.infoTitle}>Verify Your Order</Text>
                        <Text style={styles.infoDesc}>
                            Enter the same name & number used during order placement.
                        </Text>
                    </View>
                </View>

                {/* ── Form ── */}
                <View style={styles.formBox}>

                    <View style={styles.sectionLabel}>
                        <Text style={styles.sectionLabelText}>CUSTOMER DETAILS</Text>
                    </View>

                    {/* Full Name */}
                    <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>
                            Full Name <Text style={styles.star}>*</Text>
                        </Text>
                        <View style={[
                            styles.inputWrap,
                            focusedInput === 'name' && styles.inputFocused,
                            errors.fullName && styles.inputError,
                        ]}>
                            <TextInput
                                placeholder="Enter your full name"
                                placeholderTextColor="#BDBDBD"
                                style={styles.inputText}
                                value={fullName}
                                onChangeText={handleNameChange}
                                onFocus={() => setFocusedInput('name')}
                                onBlur={() => setFocusedInput(null)}
                                editable={!loading}
                                autoCapitalize="words"
                            />
                        </View>
                        {errors.fullName
                            ? <Text style={styles.errMsg}>⚠ {errors.fullName}</Text>
                            : null}
                    </View>

                    {/* Mobile */}
                    <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>
                            Mobile Number <Text style={styles.star}>*</Text>
                        </Text>
                        <View style={[
                            styles.inputWrap,
                            focusedInput === 'mobile' && styles.inputFocused,
                            errors.mobile && styles.inputError,
                        ]}>
                            <View style={styles.prefixWrap}>
                                <Text style={styles.flagText}>🇮🇳</Text>
                                <Text style={styles.prefixText}>+91</Text>
                                <View style={styles.prefixLine} />
                            </View>
                            <TextInput
                                placeholder="10-digit number"
                                placeholderTextColor="#BDBDBD"
                                style={[styles.inputText, { flex: 1 }]}
                                keyboardType="numeric"
                                value={mobile}
                                onChangeText={handleMobileChange}
                                onFocus={() => setFocusedInput('mobile')}
                                onBlur={() => setFocusedInput(null)}
                                editable={!loading}
                                maxLength={10}
                            />
                            {mobile.length === 10 && !errors.mobile && (
                                <View style={styles.validBadge}>
                                    <Text style={styles.validText}>✓</Text>
                                </View>
                            )}
                        </View>
                        {errors.mobile
                            ? <Text style={styles.errMsg}>⚠ {errors.mobile}</Text>
                            : null}
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitBtn, loading && { opacity: 0.65 }]}
                        onPress={handleConfirm}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <View style={styles.btnRow}>
                                <ActivityIndicator size="small" color={WHITE} />
                                <Text style={styles.submitBtnText}>  Verifying...</Text>
                            </View>
                        ) : (
                            <Text style={styles.submitBtnText}>CONFIRM ORDER</Text>
                        )}
                    </TouchableOpacity>

                    {/* Help */}
                    <View style={styles.helpWrap}>
                        <View style={styles.helpDividerRow}>
                            <View style={styles.helpLine} />
                            <Text style={styles.helpLineText}>Need Assistance?</Text>
                            <View style={styles.helpLine} />
                        </View>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.helpLink}>🎧 Contact JioMart Support</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Secure note */}
                <View style={styles.secureNote}>
                    <Text style={styles.secureNoteText}>🔐 100% Secure · Data never shared</Text>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },

    /* ── Header ── */
    header: {
        backgroundColor: BLUE_BG,       // ← JioMart blue (not red)
        paddingTop: scale(46),
        paddingBottom: scale(14),
        paddingHorizontal: scale(20),
        alignItems: 'center',
        elevation: 6,
        shadowColor: BLUE_BG,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        gap: scale(8),
    },
    headerSub: {
        fontSize: scale(11),
        color: 'rgba(255,255,255,0.80)',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    /* ── Trust bar ── */
    trustBar: {
        flexDirection: 'row',
        backgroundColor: NAVY,
        paddingVertical: scale(8),
        paddingHorizontal: scale(10),
        justifyContent: 'space-around',
    },
    trustItem: {
        alignItems: 'center',
        flex: 1,
    },
    trustIcon: {
        fontSize: scale(15),
        marginBottom: 2,
    },
    trustText: {
        fontSize: scale(9),
        color: '#E8EAF6',
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    scrollContent: {
        flexGrow: 1,
        paddingTop: scale(12),
    },

    /* ── Info Banner ── */
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: LIGHT_NAVY,
        marginHorizontal: scale(14),
        borderRadius: scale(10),
        paddingVertical: scale(12),
        paddingHorizontal: scale(14),
        marginBottom: scale(12),
        borderLeftWidth: 3,
        borderLeftColor: NAVY,
        gap: scale(12),
    },
    infoIconWrap: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
        backgroundColor: NAVY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoIcon: { fontSize: scale(18) },
    infoTextWrap: { flex: 1 },
    infoTitle: {
        fontSize: scale(13),
        fontWeight: '800',
        color: NAVY,
        marginBottom: 2,
    },
    infoDesc: {
        fontSize: scale(11),
        color: '#5C6BC0',
        lineHeight: scale(16),
    },

    /* ── Form ── */
    formBox: {
        backgroundColor: WHITE,
        marginHorizontal: scale(14),
        borderRadius: scale(12),
        paddingTop: 0,
        paddingHorizontal: scale(16),
        paddingBottom: scale(20),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    sectionLabel: {
        backgroundColor: LIGHT_RED,
        marginHorizontal: -scale(16),
        paddingVertical: scale(8),
        paddingHorizontal: scale(16),
        marginBottom: scale(18),
        borderBottomWidth: 1,
        borderBottomColor: '#FFCDD2',
    },
    sectionLabelText: {
        fontSize: scale(10),
        fontWeight: '800',
        color: RED,
        letterSpacing: 1.4,
    },

    /* Fields */
    fieldWrap: { marginBottom: scale(16) },
    fieldLabel: {
        fontSize: scale(12),
        fontWeight: '700',
        color: '#424242',
        marginBottom: scale(7),
        letterSpacing: 0.2,
    },
    star: { color: RED },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        borderRadius: scale(8),
        paddingHorizontal: scale(14),
        height: scale(48),
    },
    inputFocused: {
        borderColor: RED,
        backgroundColor: '#FFFAFA',
        elevation: 1,
    },
    inputError: {
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    inputText: {
        flex: 1,
        fontSize: scale(14),
        color: '#212121',
        padding: 0,
    },
    prefixWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
        gap: 4,
    },
    flagText: { fontSize: scale(15) },
    prefixText: {
        fontSize: scale(13),
        fontWeight: '800',
        color: NAVY,
    },
    prefixLine: {
        width: 1,
        height: scale(20),
        backgroundColor: '#E0E0E0',
        marginLeft: scale(8),
        marginRight: scale(4),
    },
    validBadge: {
        backgroundColor: '#E8F5E9',
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: scale(6),
    },
    validText: {
        color: '#43A047',
        fontSize: scale(12),
        fontWeight: '900',
    },
    errMsg: {
        fontSize: scale(11),
        color: '#EF4444',
        marginTop: scale(5),
        marginLeft: 2,
        fontWeight: '500',
    },

    /* Button */
    submitBtn: {
        backgroundColor: RED,
        borderRadius: scale(8),
        height: scale(50),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(8),
        elevation: 4,
        shadowColor: RED,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    submitBtnText: {
        color: WHITE,
        fontSize: scale(15),
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    /* Help */
    helpWrap: {
        marginTop: scale(20),
        alignItems: 'center',
    },
    helpDividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: scale(12),
        gap: scale(8),
    },
    helpLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEEEEE',
    },
    helpLineText: {
        fontSize: scale(10),
        color: '#9E9E9E',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    helpLink: {
        fontSize: scale(13),
        color: NAVY,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },

    /* Secure note */
    secureNote: {
        marginHorizontal: scale(14),
        marginTop: scale(12),
        paddingVertical: scale(9),
        paddingHorizontal: scale(14),
        backgroundColor: LIGHT_NAVY,
        borderRadius: scale(8),
        alignItems: 'center',
    },
    secureNoteText: {
        fontSize: scale(11),
        color: NAVY,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});