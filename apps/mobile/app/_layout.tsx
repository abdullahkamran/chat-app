import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
// import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActiveRoomContext } from '@/context/activeRoom.context';
import { AuthProvider, useAuth } from '@/context/auth.context';
import { UserContext } from '@/context/user.context';
import { useColorScheme } from '@/hooks/use-color-scheme';
// import { registerForPushNotificationsAsync, savePushTokenToServer } from '@/utils/notifications';
import { queryClient } from '@/utils/queryClient';

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
  const colorScheme = useColorScheme();
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
  //     if (token) savePushTokenToServer(userId, token);
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

  if (isLoading) return null;

  return (
    <UserContext.Provider value={{ user: { userId: userId ?? '' }, setUser: () => {} }}>
      <ActiveRoomContext.Provider value={{ activeRoomId, setActiveRoomId }}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              {isAuthenticated ? (
                <>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(avatar)" options={{ headerShown: false }} />
                  <Stack.Screen name="room" options={{ headerShown: false }} />
                  <Stack.Screen name="create-room" options={{ headerShown: false, presentation: 'modal' }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </>
              ) : (
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              )}
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </QueryClientProvider>
      </ActiveRoomContext.Provider>
    </UserContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
