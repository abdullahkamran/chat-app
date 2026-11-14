/**
 * Push notifications. Two libraries, split so each notification is handled once:
 *
 * - Firebase Messaging (`@react-native-firebase/messaging`) owns delivery: the FCM token (on iOS too,
 *   which is why we don't use `getDevicePushTokenAsync`), pushes arriving while the app is open, and
 *   taps on pushes the system showed while it was in the background or closed.
 * - `expo-notifications` owns display: permission, Android channels, the banner shown while the app is
 *   open, and taps on those banners.
 *
 * In the background or when closed, the OS shows pushes by itself. In the foreground:
 * - Android: FCM shows nothing; `onMessage` fires and we show a local banner (skipped for the room
 *   on screen).
 * - iOS: Firebase forwards the push to expo-notifications' handler, which shows it (skipped for the
 *   room on screen). We don't also show a local one.
 *
 * See docs/notifications.md.
 */
import type { PushChannelId } from '@chat-app/shared-types';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import type { NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

/** Android channels. `high` maps to AndroidImportance.HIGH, the rest to DEFAULT. */
const CHANNELS: { id: PushChannelId; name: string; description: string; high?: boolean }[] = [
  { id: 'messages', name: 'Chat messages', description: 'Messages in your rooms', high: true },
  { id: 'activity', name: 'Room activity', description: 'Visits to your room and postbox mail' },
  { id: 'social', name: 'Friends and rooms', description: 'Friend requests, and being added to a room' },
];

/** The room on screen. Its pushes aren't shown while the app is open. */
let activeRoomId: string | null = null;
export function setActivePushRoom(roomId: string | null): void {
  activeRoomId = roomId;
}

/** Whether the tap that launched the app (if any) has been looked at. */
let launchTapHandled = false;

/** The token this device last registered with the server, so logout can remove it. */
let registeredToken: string | null = null;

/** Push needs the native Firebase SDK; on web every function here does nothing. */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

type FirebaseMessaging = typeof import('@react-native-firebase/messaging');
interface PushLibs {
  fb: FirebaseMessaging;
  messaging: ReturnType<FirebaseMessaging['getMessaging']>;
  Notifications: typeof import('expo-notifications');
  Device: typeof import('expo-device');
}
let pushCache: PushLibs | null | undefined;

/**
 * The push libraries, loaded lazily, or null when this app binary doesn't include their native code.
 *
 * Firebase Messaging, expo-notifications and expo-device are native modules, so they only exist in a
 * binary built after they were added (`npx expo run:android|ios` or an EAS dev build). In Expo Go or
 * an older dev build, importing them throws while the module loads ("Native module NativeRNFBTurboApp
 * is not registered", "Cannot find native module 'ExpoTopicSubscriptionModule'"). A top-level import
 * would crash `app/_layout.tsx` and the whole app with it. Requiring them here instead lets the app
 * run without pushes: if any one is missing, every function in this file does nothing.
 */
function push(): PushLibs | null {
  if (pushCache !== undefined) return pushCache;
  pushCache = null;
  if (!supported) return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fb: FirebaseMessaging = require('@react-native-firebase/messaging');
    const Notifications: PushLibs['Notifications'] = require('expo-notifications');
    const Device: PushLibs['Device'] = require('expo-device');
    /* eslint-enable @typescript-eslint/no-require-imports */
    pushCache = { fb, messaging: fb.getMessaging(), Notifications, Device };
  } catch (e) {
    console.warn('Push notifications are off: this build is missing their native modules. Rebuild the dev client.', e);
  }
  return pushCache;
}

/** Call once at startup, before anything renders. */
export function configureNotifications(): void {
  const p = push();
  if (!p) return;
  p.Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const roomId = notification.request.content.data?.roomId;
      const show = !(typeof roomId === 'string' && roomId === activeRoomId);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });

  // Pushes with a notification part are shown by the OS while in the background; nothing to do here.
  // Registering a handler keeps Firebase from warning about it.
  p.fb.setBackgroundMessageHandler(p.messaging, async () => {});
}

async function createChannels({ Notifications }: PushLibs): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { AndroidImportance } = Notifications;
  await Promise.all(CHANNELS.map(({ id, high, ...channel }) => Notifications.setNotificationChannelAsync(id, {
    ...channel,
    importance: high ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
  })));
}

/**
 * Ask for permission (once; the OS remembers the answer) and register this device's FCM token with
 * the server, keeping it registered when FCM rotates it. Returns a cleanup for the rotation listener.
 */
export async function registerForPushNotifications(): Promise<() => void> {
  const p = push();
  if (!p) return () => {};
  const { fb, messaging, Notifications, Device } = p;
  if (!Device.isDevice) {
    console.warn('Push notifications need a physical device');
    return () => {};
  }

  // On Android 13+ the permission prompt only appears once a channel exists.
  await createChannels(p);

  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return () => {};

  const save = async (token: string) => {
    await api.post('/api/v1/users/push-token', { token });
    registeredToken = token;
  };
  await save(await fb.getToken(messaging));
  return fb.onTokenRefresh(messaging, (token) => {
    save(token).catch((e) => console.warn('Could not save the refreshed push token', e));
  });
}

/** Call on logout, while still signed in, so this device stops getting the account's pushes. */
export async function unregisterPushToken(): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  await api.delete('/api/v1/users/push-token', { token }).catch(() => {});
}

function roomOf(data: Record<string, unknown> | undefined): string | null {
  const roomId = data?.roomId;
  return typeof roomId === 'string' && roomId ? roomId : null;
}

/** Android, app open: FCM doesn't show the push, so show it as a local notification. */
function showInForeground({ Notifications }: PushLibs, message: RemoteMessage): void {
  if (Platform.OS !== 'android' || !message.notification) return;
  const data = message.data ?? {};
  if (roomOf(data) === activeRoomId) return;
  const channelId = (message.notification.android?.channelId ?? 'messages') as PushChannelId;
  Notifications.scheduleNotificationAsync({
    content: { title: message.notification.title, body: message.notification.body, data },
    trigger: { channelId },
  }).catch((e) => console.warn('Could not show a push', e));
}

/**
 * Listen for pushes while the app runs and for taps. `onOpenRoom` gets the room of a tapped push,
 * including the one that launched the app. Returns a cleanup.
 */
export function listenForNotifications(onOpenRoom: (roomId: string) => void): () => void {
  const p = push();
  if (!p) return () => {};
  const { fb, messaging, Notifications } = p;
  const open = (data: Record<string, unknown> | undefined) => {
    const roomId = roomOf(data);
    if (roomId && roomId !== activeRoomId) onOpenRoom(roomId);
  };

  const stopMessages = fb.onMessage(messaging, (message) => showInForeground(p, message));
  // Taps on pushes the OS showed (app in the background).
  const stopOpened = fb.onNotificationOpenedApp(messaging, (message) => open(message.data));
  // Taps on our foreground banners. iOS also reports taps on remote pushes here, which Firebase has
  // already reported above, so those are skipped.
  const isLocal = (response: NotificationResponse) => {
    const trigger = response.notification.request.trigger;
    return !(trigger && 'type' in trigger && trigger.type === 'push');
  };
  const responses = Notifications.addNotificationResponseReceivedListener((response) => {
    if (isLocal(response)) open(response.notification.request.content.data);
  });

  const cleanup = () => {
    stopMessages();
    stopOpened();
    responses.remove();
  };

  // A tap that launched the app from closed. Once per launch, so logging in again doesn't replay it.
  if (launchTapHandled) return cleanup;
  launchTapHandled = true;
  fb.getInitialNotification(messaging).then((message) => {
    if (message) open(message.data);
  });
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response && isLocal(response)) {
      open(response.notification.request.content.data);
      Notifications.clearLastNotificationResponseAsync();
    }
  });

  return cleanup;
}
