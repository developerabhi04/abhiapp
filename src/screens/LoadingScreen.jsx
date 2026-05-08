import React, { useEffect } from 'react';
import {
    View,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    Animated,
    Dimensions
} from "react-native";

const { width, height } = Dimensions.get('window');

const JIOMART_BLUE = '#3949AB';
const JIOMART_RED = '#E8001D';
const WHITE = '#FFFFFF';

const scale = (size) => (width / 375) * size;

/* ── JioMart Logo ── */
function JioMartLogo({ circleSize, martSize }) {
    return (
        <View style={logoStyles.row}>
            {/* Red Jio Circle */}
            <View style={{
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                backgroundColor: JIOMART_RED,
                justifyContent: 'center',
                alignItems: 'center',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            }}>
                <Text style={{
                    fontSize: circleSize * 0.22,
                    fontWeight: '900',
                    color: WHITE,
                    fontStyle: 'italic',
                    letterSpacing: -0.5,
                    includeFontPadding: false,
                    paddingHorizontal: circleSize * 0.08,
                }}>
                    jio
                </Text>
            </View>

            {/* Mart text */}
            <Text style={{
                fontSize: martSize,
                fontWeight: '800',
                color: WHITE,
                letterSpacing: 0.5,
                includeFontPadding: false,
            }}>
                Mart
            </Text>
        </View>
    );
}

const logoStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
});

/* ── Loading Screen ── */
export default function LoadingScreen({ navigation }) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const progressAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(40)).current;

    useEffect(() => {
        // Fade + slide in
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 700,
                useNativeDriver: true,
            }),
        ]).start();

        // Progress bar fill
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
        }).start();

        const timer = setTimeout(() => {
            navigation.replace('ConfirmOrder');
        }, 2200);

        return () => clearTimeout(timer);
    }, [navigation]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={JIOMART_BLUE} barStyle="light-content" />

            {/* ── Center Content ── */}
            <Animated.View style={[
                styles.centerContent,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>

                {/* JioMart Logo */}
                <View style={styles.logoWrap}>
                    <JioMartLogo
                        circleSize={scale(96)}
                        martSize={scale(56)}
                    />
                </View>

               

                {/* Tagline */}
                <Text style={styles.tagline}>DESH KI NAYI DUKAAN</Text>

                {/* Dots */}
                <View style={styles.dotsRow}>
                    <View style={[styles.dot, { backgroundColor: JIOMART_RED }]} />
                    <View style={[styles.dot, styles.dotLarge, { backgroundColor: WHITE }]} />
                    <View style={[styles.dot, { backgroundColor: JIOMART_RED }]} />
                </View>

            </Animated.View>

            {/* ── Progress Bar ── */}
            <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                    <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
                <Text style={styles.loadingText}>Loading your order details...</Text>
            </View>

            {/* ── Footer ── */}
            <View style={styles.footer}>
                <Text style={styles.footerBrand}>Avenue Supermarts Ltd</Text>
                <View style={styles.taglineContainer}>
                    <View style={styles.footerDot} />
                    <Text style={styles.footerTagline}>India's Retail Leader</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: JIOMART_BLUE,
        alignItems: 'center',
        justifyContent: 'center',
    },

    centerContent: {
        alignItems: 'center',
        marginBottom: height * 0.10,
        paddingHorizontal: scale(20),
    },

    logoWrap: {
        marginBottom: scale(20),
    },

    brandImage: {
        width: width * 0.45,
        height: 60,
        marginBottom: scale(20),
    },

    tagline: {
        fontSize: scale(13),
        color: 'rgba(255,255,255,0.82)',
        fontWeight: '800',
        letterSpacing: scale(2.2),
        textTransform: 'uppercase',
        marginBottom: scale(24),
        textAlign: 'center',
    },

    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    dot: {
        width: scale(7),
        height: scale(7),
        borderRadius: scale(4),
        opacity: 0.85,
    },
    dotLarge: {
        width: scale(9),
        height: scale(9),
        borderRadius: scale(5),
    },

    progressSection: {
        width: width * 0.58,
        alignItems: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: scale(12),
    },
    progressFill: {
        height: '100%',
        backgroundColor: JIOMART_RED,
        borderRadius: 3,
    },
    loadingText: {
        fontSize: scale(12),
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
        letterSpacing: 0.3,
    },

    footer: {
        position: 'absolute',
        bottom: height * 0.05,
        alignItems: 'center',
    },
    footerBrand: {
        fontSize: scale(12),
        color: 'rgba(255,255,255,0.55)',
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    taglineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: JIOMART_RED,
        marginRight: 6,
    },
    footerTagline: {
        fontSize: scale(11),
        color: 'rgba(255,255,255,0.45)',
        fontWeight: '500',
    },
});