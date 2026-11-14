import { QueryClientProvider } from '@tanstack/react-query';
import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import {
  DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider, enableLegacyHeaderAppearance, useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootScreen } from '@/components/BootScreen';
import { ToastHost } from '@/components/Toast';
import { DialogHost } from '@/components/ui';
import { ActiveRoomContext } from '@/context/activeRoom.context';
import { AuthProvider, useAuth } from '@/context/auth.context';
import { UserContext } from '@/context/user.context';
import { ThemeProvider, useTheme } from '@/constants/theme';
import {
  configureNotifications, listenForNotifications, registerForPushNotifications, setActivePushRoom,
} from '@/utils/notifications';
import { queryClient } from '@/utils/queryClient';

// Keep the opaque, theme-styled stack header on iOS 26+ instead of SDK 58's Liquid Glass default.
enableLegacyHeaderAppearance();

configureNotifications();

// Keep the native splash up until the fonts are in, then BootScreen takes over while signing in.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppNavigator() {
  const t = useTheme();
  const router = useRouter();
  const { userId, isLoading, bootFailed, retryBoot, isAuthenticated } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated]);

  // Pushes: register this device once signed in, and open the room of a tapped push.
  useEffect(() => {
    if (!userId) return;
    let stopTokenRefresh: (() => void) | undefined;
    let cancelled = false;
    registerForPushNotifications()
      .then((stop) => (cancelled ? stop() : (stopTokenRefresh = stop)))
      .catch((e) => console.warn('Push registration failed', e));
    const stopListening = listenForNotifications((roomId) => router.push(`/room/${roomId}`));
    return () => {
      cancelled = true;
      stopTokenRefresh?.();
      stopListening();
    };
  }, [userId, router]);

  // Pushes for the room on screen aren't shown.
  useEffect(() => setActivePushRoom(activeRoomId), [activeRoomId]);

  // React Navigation's own theme, from ours: screen backgrounds, headers and the tab bar.
  const navigationTheme = useMemo(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.primary,
        background: t.colors.background,
        card: t.colors.surface,
        text: t.colors.text,
        border: t.colors.border,
        notification: t.colors.primary,
      },
    };
  }, [t]);

  if (isLoading) return <BootScreen failed={bootFailed} onRetry={retryBoot} />;

  return (
    <UserContext.Provider value={{ user: { userId: userId ?? '' }, setUser: () => {} }}>
      <ActiveRoomContext.Provider value={{ activeRoomId, setActiveRoomId }}>
        <QueryClientProvider client={queryClient}>
          <NavigationThemeProvider value={navigationTheme}>
            <Stack>
              <Stack.Protected guard={isAuthenticated}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(avatar)" options={{ headerShown: false }} />
                <Stack.Screen name="room" options={{ headerShown: false }} />
                <Stack.Screen name="create-room" options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="room-members" options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="add-friends" options={{ headerShown: false, presentation: 'modal' }} />
              </Stack.Protected>
              <Stack.Protected guard={!isAuthenticated}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              </Stack.Protected>
            </Stack>
            <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
            <ToastHost />
            <DialogHost />
          </NavigationThemeProvider>
        </QueryClientProvider>
      </ActiveRoomContext.Provider>
    </UserContext.Provider>
  );
}

export default function RootLayout() {
  // Every font the theme's type styles name (constants/theme/tokens.ts).
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  // The native splash is still showing. On a font error, carry on with system fonts.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
