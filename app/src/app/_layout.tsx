import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_600SemiBold, NotoSansArabic_700Bold, NotoSansArabic_800ExtraBold } from '@expo-google-fonts/noto-sans-arabic';
import { ApiProvider, useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { useFont } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready, conn, t } = useApi();
  const seg = useSegments();
  const router = useRouter();
  const font = useFont();
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    const onPair = seg[0] === 'pair';
    if (!conn && !onPair) router.replace('/pair');
    if (conn && onPair) router.replace('/');
  }, [ready, conn, seg, router]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>;
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: C.surface }, headerTintColor: C.ink, headerTitleStyle: { fontFamily: font(800), fontSize: 17 }, headerShadowVisible: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="pair" options={{ headerShown: false }} />
      <Stack.Screen name="lead/[id]" options={{ title: t('Details') }} />
      <Stack.Screen name="demo/[slug]" options={{ title: t('Demo website') }} />
      <Stack.Screen name="message/[id]" options={{ title: t('Message') }} />
    </Stack>
  );
}

export default function Root() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
    NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_600SemiBold, NotoSansArabic_700Bold, NotoSansArabic_800ExtraBold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.navy }} />;
  return (
    <SafeAreaProvider>
      <ApiProvider>
        <StatusBar style="dark" />
        <Gate />
      </ApiProvider>
    </SafeAreaProvider>
  );
}
