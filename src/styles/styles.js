import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        backgroundColor: '#84C225',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    headerText: {
        backgroundColor: '#84C225',
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
        padding: 20,
        textAlign: "center",

    },
    card: {
        margin: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fafafa',
    },
    label: {
        fontSize: 14,
        color: '#333',
        fontWeight: 'bold',
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
        color: '#333',
    },
    subText: {
        fontSize: 12,
        color: '#777',
    },
    logoSmallContainer: {
        position: 'absolute',
        right: 16,
        top: 16,
        alignItems: 'center',
    },
    logoSmallText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#84C225',
    },
    logoSmallSub: {
        fontSize: 10,
        color: '#84C225',
    },
    stepperContainer: {
        marginTop: 16,
        marginHorizontal: 16,
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        marginBottom: 20,
    },
    iconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    iconDone: {
        backgroundColor: '#84C225',
    },
    iconPending: {
        backgroundColor: '#E0E0E0',
        borderWidth: 2,
        borderColor: '#bbb',
    },
    iconDoneText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    iconPendingText: {
        color: '#bbb',
        fontSize: 14,
    },
    stepLabelContainer: {
        marginLeft: 15,
        paddingVertical: 8,
    },
    stepLabel: {
        fontSize: 16,
        color: '#777',
    },
    stepLabelDone: {
        color: '#333',
        fontWeight: '500',
    },
    stepConnector: {
        position: 'absolute',
        top: 35,
        left: 15,
        width: 2,
        height: 30,
        backgroundColor: '#ddd',
        zIndex: 0,
    },
    connectorActive: {
        backgroundColor: '#84C225',
    },
    footerLinks: {
        marginTop: 32,
        paddingHorizontal: 16,
    },
    footerText: {
        fontSize: 12,
        color: '#555',
        textAlign: 'center',
        marginVertical: 2,
    },
    nextButton: {
        margin: 16,
        backgroundColor: '#84C225',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    monitorSection: {
        margin: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#f9f9f9',
    },
    monitorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    monitorStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },

    // LoadingScreen styles
    loadingScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    logo: {
        width: 200,
        height: 80,
    },

    // ConfirmOrderScreen styles
    confirmContainer: {
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: 60,
        padding:20,
        backgroundColor: '#fff',
    },
    confirmInstruction: {
        fontSize: 14,
        color: '#67a40bff',
        textAlign: 'center',
        marginVertical: 30,
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 24,
    },
    textInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#84C225',
        marginVertical: 12,
        paddingVertical: 12,
        fontSize: 16,
        color: '#181a70ff',
    },
    confirmButton: {
        backgroundColor: '#84C225',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 8,
        marginBottom: 30,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    statusContainer: {
        backgroundColor: '#f9f9f9',
        width: '100%',
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    statusText: {
        fontSize: 14,
        color: '#666',
    },
});
