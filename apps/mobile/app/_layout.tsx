import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActiveRoomContext } from '@/context/activeRoom.context';
import { User, UserContext } from '@/context/user.context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { USER_ID1 } from '@/utils/config';
import { registerForPushNotificationsAsync, savePushTokenToServer } from '@/utils/notifications';
import { queryClient } from '@/utils/queryClient';

// Reference to activeRoomId for the notification handler (avoids stale closures)
let activeRoomIdRef: string | null = null;

// Smart foreground suppression: suppress notifications for the room the user is currently viewing
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const roomId = notification.request.content.data?.roomId;
    const shouldSuppress = roomId && roomId === activeRoomIdRef;

    return {
      shouldShowAlert: !shouldSuppress,
      shouldShowBanner: !shouldSuppress,
      shouldShowList: !shouldSuppress,
      shouldPlaySound: !shouldSuppress,
      shouldSetBadge: false,
    };
  },
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [user, setUser] = useState<User | null>({
    userId: USER_ID1,
  });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  const userContext = { user, setUser };

  // Keep the module-level ref in sync with state
  useEffect(() => {
    activeRoomIdRef = activeRoomId;
  }, [activeRoomId]);

  // Register for push notifications and save token to server
  useEffect(() => {
    if (!user?.userId) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        savePushTokenToServer(user.userId, token);
      }
    });
  }, [user?.userId]);

  // Handle notification taps — navigate to the room
  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const roomId = response.notification.request.content.data?.roomId;
        if (roomId) {
          router.push(`/room/${roomId}`);
        }
      }
    );

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <UserContext.Provider value={userContext}>
        <ActiveRoomContext.Provider value={{ activeRoomId, setActiveRoomId }}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </QueryClientProvider>
        </ActiveRoomContext.Provider>
      </UserContext.Provider>
    </SafeAreaProvider>
  );
}
