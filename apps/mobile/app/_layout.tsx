import { QueryClientProvider } from '@tanstack/react-query';
// import * as Notifications from 'expo-notifications';
import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import {
  DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider, enableLegacyHeaderAppearance, useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/Toast';
import { ActiveRoomContext } from '@/context/activeRoom.context';
import { AuthProvider, useAuth } from '@/context/auth.context';
import { UserContext } from '@/context/user.context';
import { ThemeProvider, useTheme } from '@/constants/theme';
// import { registerForPushNotificationsAsync, savePushTokenToServer } from '@/utils/notifications';
import { queryClient } from '@/utils/queryClient';

// Keep the opaque, theme-styled stack header on iOS 26+ instead of SDK 58's Liquid Glass default.
enableLegacyHeaderAppearance();

// // Smart foreground suppression: suppress notifications for the room the user is currently viewing
// Notifications.setNotificationHandler({
//   handleNotification: async (notification) => {
//     const roomId = notification.request.content.data?.roomId;
//     const shouldSuppress = roomId && roomId === activeRoomIdRef;
//     return {
//       shouldShowAlert: !shouldSuppress,
//       shouldShowBanner: !shouldSuppress,
//       shouldShowList: !shouldSuppress,
//       shouldPlaySound: !shouldSuppress,
//       shouldSetBadge: false,
//     };
//   },
// });

function AppNavigator() {
  const t = useTheme();
  const router = useRouter();
  const { userId, isLoading, isAuthenticated } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated]);

  // // Register for push notifications once authenticated
  // useEffect(() => {
  //   if (!userId) return;
  //   registerForPushNotificationsAsync().then((token) => {
  //     if (token) savePushTokenToServer(token);
  //   });
  // }, [userId]);

  // // Handle notification taps — navigate to the room
  // useEffect(() => {
  //   const sub = Notifications.addNotificationResponseReceivedListener((response) => {
  //     const roomId = response.notification.request.content.data?.roomId;
  //     if (roomId) router.push(`/room/${roomId}`);
  //   });
  //   return () => sub.remove();
  // }, [router]);

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

  if (isLoading) return null;

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
  // On a font error, carry on with system fonts rather than a blank screen.
  if (!fontsLoaded && !fontError) return null;

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
