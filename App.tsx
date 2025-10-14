import React, { useCallback, useEffect, useMemo, useRef, useState } from
        'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View,
    AppState, Alert } from 'react-native';
import * as Linking from 'expo-linking';
/**
 * Deep Link Tester (Expo + Bare)
 * - Input a URL and open it to trigger another app's deep link
 * - Receive deep links (cold start + warm) and render raw + parsed data
 * - Uses expo-linking for open/parse/getInitialURL
 */
type ParsedLink = {
    raw: string;
    scheme?: string;
    hostname?: string | null;
    path?: string | null;
    queryParams?: Record<string, string>;
    ts: number;
    source: 'initial' | 'event';
};

export default function App() {
// Change this default to your primary app's link for faster testing
    const [url, setUrl] = useState('myapp://special?foo=123&bar=baz');
    const [received, setReceived] = useState<ParsedLink[]>([]);
    const appState = useRef(AppState.currentState);
    const hasHandledInitial = useRef(false);
    const parseAndStore = useCallback((incomingUrl: string | null, source:
        'initial' | 'event') => {
        if (!incomingUrl) return;
        try {
            const parsed = Linking.parse(incomingUrl);
            setReceived((prev) => [
                {
                    raw: incomingUrl,
                    scheme: parsed.scheme,
                    hostname: parsed.hostname ?? null,
                    path: parsed.path ?? null,
                    queryParams: parsed.queryParams ?? undefined,
                    ts: Date.now(),
                    source,
                },
                ...prev,
            ]);
        } catch (e) {
            setReceived((prev) => [
                { raw: incomingUrl, ts: Date.now(), source, path: null, hostname:
                        null, queryParams: undefined },
                ...prev,
            ]);
        }
    }, []);
// Validate a URL quickly before trying to open
    const isLikelyUrl = useMemo(() => {
        if (!url) return false;
// Accept custom schemes and https
        return /^(?:[a-zA-Z][a-zA-Z0-9+.-]*):\/\//.test(url.trim());
    }, [url]);
    useEffect(() => {
// Handle cold start exactly once
        Linking.getInitialURL().then((initial) => {
            if (hasHandledInitial.current) return;
            hasHandledInitial.current = true;
            parseAndStore(initial, 'initial');
        });
// Subscribe for warm/resume deep links
        const sub = Linking.addEventListener('url', (evt) =>
            parseAndStore(evt.url, 'event'));
// Track foreground/background (not strictly required, but useful for OEM
        const appSub = AppState.addEventListener('change', (next) => {
            appState.current = next;
        });
        return () => {
            sub.remove();
            appSub.remove();
        };
    }, [parseAndStore]);
    const openTarget = useCallback(async () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        if (!isLikelyUrl) {
            Alert.alert('Invalid URL', 'Enter a valid URL with a scheme, e.g.myapp://route?x=1 or https://example.com/path');
                return;
        }
        try {
            await Linking.openURL(trimmed);
        } catch (err: any) {
            Alert.alert('Failed to open URL', String(err?.message ?? err));
        }
    }, [url, isLikelyUrl]);
    const clearReceived = useCallback(() => setReceived([]), []);
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1220', paddingTop: 50 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}
                        keyboardShouldPersistTaps="handled">
                <Text style={{ color: 'white', fontSize: 24, fontWeight: '700',
                    marginBottom: 4 }}>
                    Deep Link Tester
                </Text>
                <Text style={{ color: '#9FB3C8', marginBottom: 12 }}>
                    Type a deep link and tap Open. If another app calls back into this
                    tester, you'll see the payload below.
                </Text>
                <View style={{ backgroundColor:
                        '#121B2E', borderRadius: 14, padding: 12, borderWidth: 1, borderColor:
                        '#1F2A44', marginBottom: 10 }}>
                    <TextInput
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="myapp://special?foo=123&bar=baz"
                        placeholderTextColor="#62708A"
                        style={{ color: 'white', fontSize: 16 }}
                        accessibilityLabel="Deep link input"
                    />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                    <Pressable
                        onPress={openTarget}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                            backgroundColor: pressed ? '#3A55E0' : '#4C6FFF',
                            paddingVertical: 14,
                            paddingHorizontal: 18,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000', shadowOpacity: 0.25, shadowOffset:
                                { width: 0, height: 6 }, shadowRadius: 10, elevation: 4,
                        })}
                    >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}
                        >Open URL</Text>
                    </Pressable>
                    <Pressable
                        onPress={clearReceived}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                            backgroundColor: pressed ? '#2E3A5F' : '#1E2A4A',
                            paddingVertical: 14,
                            paddingHorizontal: 18,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#31406A',
                        })}
                    >
                        <Text style={{ color: '#AFC3FF', fontWeight: '600', fontSize:
                                16 }}>Clear</Text>
                    </Pressable>
                </View>
                <Text style={{ color: '#9FB3C8', marginBottom: 8 }}>Received deep
                    links (most recent first):</Text>
                {received.length === 0 ? (
                    <View style={{ padding: 16, backgroundColor: '#0F1730',
                        borderRadius: 12, borderColor: '#1F2A44', borderWidth: 1 }}>
                        <Text style={{ color: '#62708A' }}>No deep links yet. When
                            another app opens tester:// or https links bound here, they'll appear.</Text>
                    </View>
                ) : (
                    received.map((item, idx) => (
                        <View
                            key={`${item.ts}-${idx}`}
                            style={{ padding: 14, backgroundColor: '#0F1730',
                                borderRadius: 12, borderColor: '#1F2A44', borderWidth: 1, marginBottom: 10 }}
                        >
                            <Text style={{ color: '#A9B9D5', marginBottom: 6 }}>
                                {new Date(item.ts).toLocaleString()} •
                                {item.source.toUpperCase()}
                            </Text>
                            <Text style={{ color: 'white', fontWeight: '700',
                                marginBottom: 6 }}>Raw URL</Text>
                            <Text style={{ color: '#E5ECFF', marginBottom: 8 }}>{item.raw}
                            </Text>
                            <View style={{ height: 1, backgroundColor: '#1F2A44',
                                marginVertical: 8 }} />
                            <Text style={{ color: 'white', fontWeight: '700',
                                marginBottom: 6 }}>Parsed</Text>
                            <Text style={{ color: '#E5ECFF' }}>scheme: {item.scheme ?? '—'}
                            </Text>
                            <Text style={{ color: '#E5ECFF' }}>hostname: {item.hostname ??
                                '—'}</Text>
                            <Text style={{ color: '#E5ECFF' }}>path: {item.path ?? '—'}</
                                Text>
                            <Text style={{ color: '#E5ECFF', marginTop: 6, marginBottom:
                                    2 }}>queryParams:</Text>
                            {item.queryParams && Object.keys(item.queryParams).length >
                            0 ? (
                                Object.entries(item.queryParams).map(([k, v]) => (
                                    <Text key={k} style={{ color: '#C9D7FF' }}>• {k}:
                                        {String(v)}</Text>
                                ))
                            ) : (
                                <Text style={{ color: '#C9D7FF' }}>—</Text>
                            )}
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}
