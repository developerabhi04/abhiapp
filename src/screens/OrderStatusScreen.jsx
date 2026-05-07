import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StatusBar,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDER_CONFIRMED_KEY = '@order_confirmed';
const { width } = Dimensions.get('window');

const RED = '#E8001D';
const NAVY = '#1A237E';
const BLUE = '#1565C0';
const LIGHT_BLUE = '#E8EAF6';
const LIGHT_RED = '#FFF0F1';
const WHITE = '#FFFFFF';

const scale = (size) => (width / 375) * size;

/* ── JioMart Logo ── */
function JioMartLogo({ circleSize = scale(36), martSize = scale(22) }) {
    return (
        <View style={logoStyles.row}>
            <View style={[
                logoStyles.circle,
                { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }
            ]}>
                <Text style={[
                    logoStyles.jioText,
                    { fontSize: circleSize * 0.30, lineHeight: circleSize * 0.38 }
                ]}>
                    jio
                </Text>
            </View>
            <Text style={[logoStyles.martText, { fontSize: martSize }]}>Mart</Text>
        </View>
    );
}

const logoStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
    },
    circle: {
        backgroundColor: RED,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
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
export default function OrderStatusScreen({ navigation, route }) {
    const [userData, setUserData] = useState(null);
    const [orderDate, setOrderDate] = useState(new Date());
    const [orderSteps, setOrderSteps] = useState([
        { key: 'confirmed', label: 'Order Confirmed', icon: '📋', daysAfterOrder: 0, done: false },
        { key: 'processed', label: 'Processing', icon: '⚙️', daysAfterOrder: 2, done: false },
        { key: 'shipped', label: 'Shipped', icon: '🚚', daysAfterOrder: 4, done: false },
        { key: 'delivered', label: 'Delivered', icon: '🏠', daysAfterOrder: 6, done: false },
    ]);

    useEffect(() => { loadUserData(); }, []);

    /* ── Full D-Mart loadUserData logic ── */
    const loadUserData = async () => {
        try {
            if (route?.params?.userData) {
                setUserData(route.params.userData);
                if (route.params.userData.orderDate) {
                    setOrderDate(new Date(route.params.userData.orderDate));
                }
                return;
            }

            const orderData = await AsyncStorage.getItem(ORDER_CONFIRMED_KEY);
            if (orderData) {
                const parsedData = JSON.parse(orderData);
                setUserData(parsedData);
                if (parsedData.orderDate) {
                    setOrderDate(new Date(parsedData.orderDate));
                }
            } else {
                Alert.alert('No Order Found', 'Please complete your order first', [
                    { text: 'OK', onPress: () => navigation.replace('ConfirmOrder') }
                ]);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            Alert.alert('Error', 'Failed to load order data');
        }
    };

    const formatDate = (date) => {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getExpectedDeliveryDate = () => {
        if (!orderDate || isNaN(orderDate.getTime())) return 'N/A';
        const d = new Date(orderDate);
        d.setDate(orderDate.getDate() + 6);
        return formatDate(d);
    };

    /* ── Full D-Mart calculateOrderStatus logic ── */
    useEffect(() => {
        const calculateOrderStatus = () => {
            if (!orderDate || isNaN(orderDate.getTime())) return;
            const now = new Date();
            setOrderSteps(prev => prev.map(step => {
                const targetDate = new Date(orderDate);
                targetDate.setDate(orderDate.getDate() + step.daysAfterOrder);
                return { ...step, done: now >= targetDate, targetDate };
            }));
        };

        calculateOrderStatus();
        const interval = setInterval(calculateOrderStatus, 60000);
        return () => clearInterval(interval);
    }, [orderDate]);

    const completedCount = orderSteps.filter(s => s.done).length;
    const progressPercent = (completedCount / orderSteps.length) * 100;
    const currentStep = orderSteps.find(s => !s.done) || orderSteps[orderSteps.length - 1];

    /* ── Loading State ── */
    if (!userData) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar backgroundColor={NAVY} barStyle="light-content" />
                <ActivityIndicator size="large" color={RED} />
                <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={NAVY} barStyle="light-content" />

            {/* ── Header ── */}
            <View style={styles.header}>
                {/* Logo Row */}
                <View style={styles.headerLogoRow}>
                    <JioMartLogo circleSize={scale(36)} martSize={scale(22)} />
                </View>

                {/* Success Row */}
                <View style={styles.headerSuccessRow}>
                    <View style={styles.successBadge}>
                        <Text style={styles.successBadgeText}>✓</Text>
                    </View>
                    <View style={styles.headerTextCol}>
                        <Text style={styles.headerTitle}>Order Confirmed!</Text>
                        <Text style={styles.headerSub}>
                            Hi {userData.fullName?.split(' ')[0]}, we've received your order 🎉
                        </Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {completedCount}/{orderSteps.length} steps done
                    </Text>
                </View>
            </View>

            {/* ── Status Tag Bar ── */}
            <View style={styles.statusTagBar}>
                <Text style={styles.statusTagText}>
                    📍 Currently:{' '}
                    <Text style={styles.statusTagBold}>{currentStep.label}</Text>
                </Text>
            </View>

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── Delivery Banner ── */}
                <View style={styles.deliveryBanner}>
                    <View style={styles.deliveryLeft}>
                        <Text style={styles.deliveryLabel}>EXPECTED DELIVERY</Text>
                        <Text style={styles.deliveryDate}>{getExpectedDeliveryDate()}</Text>
                        <Text style={styles.deliveryNote}>Within 5–7 working days</Text>
                    </View>
                    <View style={styles.deliveryRight}>
                        <Text style={styles.deliveryTruckIcon}>🚚</Text>
                    </View>
                </View>

                {/* ── Order Details Card ── */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                            <View style={styles.cardAccent} />
                            <Text style={styles.cardTitle}>Order Details</Text>
                        </View>
                        <View style={styles.orderIdBadge}>
                            <Text style={styles.orderIdBadgeText}>
                                #{(userData.orderId || 'DM2024079439').slice(-6)}
                            </Text>
                        </View>
                    </View>

                    {[
                        { label: 'Order ID', value: userData.orderId || 'DM2024079439', mono: true },
                        { label: 'Order Date', value: formatDate(orderDate) },
                        { label: 'Customer', value: userData.fullName },
                        { label: 'Mobile', value: `+91 ${userData.mobile}` },
                    ].map((item, i, arr) => (
                        <View key={item.label}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>{item.label}</Text>
                                <Text style={[
                                    styles.detailValue,
                                    item.mono && styles.detailValueMono,
                                ]}>
                                    {item.value}
                                </Text>
                            </View>
                            {i < arr.length - 1 && <View style={styles.rowDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── Order Tracking Card ── */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                            <View style={styles.cardAccent} />
                            <Text style={styles.cardTitle}>Track Your Order</Text>
                        </View>
                    </View>

                    <View style={styles.timeline}>
                        {orderSteps.map((step, index) => {
                            const isLast = index === orderSteps.length - 1;
                            const isDone = step.done;
                            const isNext = !isDone && (index === 0 || orderSteps[index - 1].done);

                            return (
                                <View key={step.key} style={styles.timelineRow}>
                                    {/* Left indicator */}
                                    <View style={styles.timelineIndicator}>
                                        <View style={[
                                            styles.stepDot,
                                            isDone && styles.stepDotDone,
                                            isNext && styles.stepDotActive,
                                        ]}>
                                            {isDone
                                                ? <Text style={styles.stepCheckMark}>✓</Text>
                                                : <View style={[
                                                    styles.stepInnerDot,
                                                    isNext && styles.stepInnerDotActive,
                                                ]} />
                                            }
                                        </View>
                                        {!isLast && (
                                            <View style={[
                                                styles.stepConnector,
                                                isDone && styles.stepConnectorDone,
                                            ]} />
                                        )}
                                    </View>

                                    {/* Right content */}
                                    <View style={[styles.stepBody, isLast && { paddingBottom: 0 }]}>
                                        <View style={styles.stepRow}>
                                            <Text style={styles.stepEmoji}>{step.icon}</Text>
                                            <Text style={[
                                                styles.stepLabel,
                                                isDone && styles.stepLabelDone,
                                                isNext && styles.stepLabelActive,
                                            ]}>
                                                {step.label}
                                            </Text>
                                            {isDone && (
                                                <View style={styles.pillDone}>
                                                    <Text style={styles.pillDoneText}>✓ Done</Text>
                                                </View>
                                            )}
                                            {isNext && (
                                                <View style={styles.pillActive}>
                                                    <Text style={styles.pillActiveText}>In Progress</Text>
                                                </View>
                                            )}
                                        </View>
                                        {step.targetDate && (
                                            <Text style={[
                                                styles.stepDateText,
                                                isDone && { color: '#43A047' },
                                            ]}>
                                                {isDone ? '✔ Completed on' : 'Expected by'}: {formatDate(step.targetDate)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ── Info Strip ── */}
                <View style={styles.infoStrip}>
                    <Text style={styles.infoStripIcon}>📢</Text>
                    <Text style={styles.infoStripText}>
                        SMS & notification updates will be sent to your registered mobile number.
                    </Text>
                </View>

                {/* ── Help Card ── */}
                <View style={styles.helpCard}>
                    <View style={styles.helpCardLeft}>
                        <Text style={styles.helpTitle}>Need Help?</Text>
                        <Text style={styles.helpSub}>JioMart support is available 24/7</Text>
                    </View>
                    <TouchableOpacity style={styles.helpBtn} activeOpacity={0.8}>
                        <Text style={styles.helpBtnText}>Contact Us</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Footer ── */}
                <View style={styles.footer}>
                    <View style={styles.footerDotRow}>
                        <View style={[styles.footerDot, { backgroundColor: RED }]} />
                        <View style={[styles.footerDot, { backgroundColor: NAVY }]} />
                        <View style={[styles.footerDot, { backgroundColor: RED }]} />
                    </View>
                    <Text style={styles.footerText}>A Reliance Retail Initiative</Text>
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F6FB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F4F6FB',
    },
    loadingText: {
        fontSize: scale(13),
        color: NAVY,
        marginTop: scale(12),
        fontWeight: '600',
    },

    /* ── Header ── */
    header: {
        backgroundColor: NAVY,
        paddingTop: scale(46),
        paddingBottom: scale(14),
        paddingHorizontal: scale(16),
        elevation: 6,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    headerLogoRow: {
        alignItems: 'center',
        marginBottom: scale(12),
    },
    headerSuccessRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
        gap: scale(12),
    },
    successBadge: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: RED,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    successBadgeText: {
        fontSize: scale(20),
        color: WHITE,
        fontWeight: '900',
    },
    headerTextCol: {
        flex: 1,
    },
    headerTitle: {
        fontSize: scale(18),
        fontWeight: '900',
        color: WHITE,
        letterSpacing: 0.3,
    },
    headerSub: {
        fontSize: scale(12),
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    progressTrack: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: RED,
        borderRadius: 4,
    },
    progressText: {
        fontSize: scale(11),
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '700',
        minWidth: scale(80),
        textAlign: 'right',
    },

    /* ── Status Tag Bar ── */
    statusTagBar: {
        backgroundColor: BLUE,
        paddingVertical: scale(7),
        paddingHorizontal: scale(16),
        alignItems: 'center',
    },
    statusTagText: {
        fontSize: scale(12),
        color: '#E8EAF6',
        fontWeight: '500',
    },
    statusTagBold: {
        color: WHITE,
        fontWeight: '800',
    },

    scroll: { flex: 1 },
    scrollContent: { paddingTop: scale(12) },

    /* ── Delivery Banner ── */
    deliveryBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: NAVY,
        marginHorizontal: scale(14),
        borderRadius: scale(12),
        paddingVertical: scale(14),
        paddingHorizontal: scale(18),
        marginBottom: scale(12),
        elevation: 3,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    deliveryLeft: {},
    deliveryLabel: {
        fontSize: scale(10),
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '700',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    deliveryDate: {
        fontSize: scale(22),
        fontWeight: '900',
        color: WHITE,
        marginBottom: 2,
    },
    deliveryNote: {
        fontSize: scale(11),
        color: 'rgba(255,255,255,0.65)',
    },
    deliveryRight: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        width: scale(52),
        height: scale(52),
        borderRadius: scale(26),
        justifyContent: 'center',
        alignItems: 'center',
    },
    deliveryTruckIcon: {
        fontSize: scale(26),
    },

    /* ── Cards ── */
    card: {
        backgroundColor: WHITE,
        marginHorizontal: scale(14),
        marginBottom: scale(12),
        borderRadius: scale(12),
        paddingTop: 0,
        paddingHorizontal: scale(16),
        paddingBottom: scale(16),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: LIGHT_BLUE,
        marginHorizontal: -scale(16),
        paddingVertical: scale(10),
        paddingHorizontal: scale(16),
        marginBottom: scale(14),
        borderBottomWidth: 1,
        borderBottomColor: '#C5CAE9',
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardAccent: {
        width: 3,
        height: scale(16),
        backgroundColor: RED,
        borderRadius: 2,
        marginRight: scale(10),
    },
    cardTitle: {
        fontSize: scale(14),
        fontWeight: '800',
        color: NAVY,
    },
    orderIdBadge: {
        backgroundColor: NAVY,
        paddingHorizontal: scale(10),
        paddingVertical: 3,
        borderRadius: scale(20),
    },
    orderIdBadgeText: {
        fontSize: scale(10),
        color: WHITE,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: scale(10),
    },
    detailLabel: {
        fontSize: scale(12),
        color: '#757575',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: scale(13),
        fontWeight: '700',
        color: '#212121',
        maxWidth: width * 0.55,
        textAlign: 'right',
    },
    detailValueMono: {
        fontFamily: 'monospace',
        color: NAVY,
        fontSize: scale(12),
    },
    rowDivider: {
        height: 1,
        backgroundColor: '#F5F5F5',
    },

    /* ── Timeline ── */
    timeline: { paddingTop: 2 },
    timelineRow: { flexDirection: 'row' },
    timelineIndicator: {
        alignItems: 'center',
        width: scale(30),
        marginRight: scale(14),
    },
    stepDot: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 2,
        borderColor: '#BDBDBD',
        backgroundColor: WHITE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotDone: {
        backgroundColor: '#43A047',
        borderColor: '#43A047',
    },
    stepDotActive: {
        borderColor: RED,
        backgroundColor: LIGHT_RED,
    },
    stepCheckMark: {
        fontSize: scale(13),
        color: WHITE,
        fontWeight: '900',
    },
    stepInnerDot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        backgroundColor: '#BDBDBD',
    },
    stepInnerDotActive: {
        backgroundColor: RED,
    },
    stepConnector: {
        width: 2,
        flex: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 3,
        minHeight: scale(24),
    },
    stepConnectorDone: {
        backgroundColor: '#43A047',
    },
    stepBody: {
        flex: 1,
        paddingBottom: scale(18),
        paddingTop: 3,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: scale(6),
        marginBottom: 4,
    },
    stepEmoji: { fontSize: scale(14) },
    stepLabel: {
        fontSize: scale(13),
        fontWeight: '600',
        color: '#9E9E9E',
    },
    stepLabelDone: { color: '#212121' },
    stepLabelActive: { color: RED, fontWeight: '800' },
    pillDone: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: scale(8),
        paddingVertical: 2,
        borderRadius: scale(20),
    },
    pillDoneText: {
        fontSize: scale(10),
        color: '#2E7D32',
        fontWeight: '700',
    },
    pillActive: {
        backgroundColor: LIGHT_RED,
        paddingHorizontal: scale(8),
        paddingVertical: 2,
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    pillActiveText: {
        fontSize: scale(10),
        color: RED,
        fontWeight: '700',
    },
    stepDateText: {
        fontSize: scale(11),
        color: '#9E9E9E',
    },

    /* ── Info Strip ── */
    infoStrip: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: LIGHT_BLUE,
        marginHorizontal: scale(14),
        marginBottom: scale(12),
        borderRadius: scale(8),
        paddingVertical: scale(10),
        paddingHorizontal: scale(14),
        gap: scale(10),
        borderLeftWidth: 3,
        borderLeftColor: NAVY,
    },
    infoStripIcon: { fontSize: scale(14), marginTop: 1 },
    infoStripText: {
        flex: 1,
        fontSize: scale(12),
        color: NAVY,
        lineHeight: scale(18),
        fontWeight: '500',
    },

    /* ── Help Card ── */
    helpCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: WHITE,
        marginHorizontal: scale(14),
        marginBottom: scale(12),
        borderRadius: scale(12),
        paddingVertical: scale(14),
        paddingHorizontal: scale(16),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    helpCardLeft: {},
    helpTitle: {
        fontSize: scale(14),
        fontWeight: '800',
        color: NAVY,
    },
    helpSub: {
        fontSize: scale(11),
        color: '#757575',
        marginTop: 2,
    },
    helpBtn: {
        backgroundColor: RED,
        paddingHorizontal: scale(18),
        paddingVertical: scale(9),
        borderRadius: scale(8),
        elevation: 2,
        shadowColor: RED,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    helpBtnText: {
        fontSize: scale(12),
        fontWeight: '800',
        color: WHITE,
        letterSpacing: 0.4,
    },

    /* ── Footer ── */
    footer: {
        alignItems: 'center',
        paddingVertical: scale(12),
    },
    footerDotRow: {
        flexDirection: 'row',
        gap: scale(6),
        marginBottom: 6,
        alignItems: 'center',
    },
    footerDot: {
        width: scale(5),
        height: scale(5),
        borderRadius: scale(3),
    },
    footerText: {
        fontSize: scale(11),
        color: '#9E9E9E',
        letterSpacing: 0.3,
    },
});