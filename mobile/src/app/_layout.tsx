import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/providers/auth-provider';
import { AppDataProvider } from '@/providers/app-data-provider';
import { colors } from '@/theme/colors';
import { readPushNavigationData } from '@/lib/push-notifications';

import '@/lib/background-drive';

void SplashScreen.preventAutoHideAsync();

const cruiserTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.lime,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.rose,
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = readPushNavigationData(response);
      if ((data.type === 'forum-like' || data.type === 'forum-reply') && data.targetId) {
        router.push({ pathname: '/(tabs)/forum', params: { threadId: data.targetId } });
        return;
      }
      if (data.type === 'direct-message' && (data.threadId || data.targetId)) {
        router.push({
          pathname: '/(tabs)/social',
          params: { section: 'messages', threadId: data.threadId || data.targetId },
        });
        return;
      }
      if (data.actionType === 'convoy') {
        router.push('/(tabs)/map');
        return;
      }
      if (data.actionType === 'garage') {
        router.push({ pathname: '/(tabs)/profile', params: { section: 'service' } });
        return;
      }
      if (data.actionType === 'social' || data.actionType === 'clan') {
        router.push('/(tabs)/social');
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openNotification(response);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => subscription.remove();
  }, [router]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={cruiserTheme}>
      <AuthProvider>
        <AppDataProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AppDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
