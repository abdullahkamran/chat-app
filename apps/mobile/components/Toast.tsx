import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

/** How long a toast stays up. */
const SHOW_MS = 3500;

export interface ToastMessage {
  text: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

type Listener = (message: ToastMessage) => void;
let listener: Listener | null = null;

/** Show a short in-app notice at the top of the screen, over whatever is open. */
export function showToast(message: ToastMessage): void {
  listener?.(message);
}

/** Renders toasts from `showToast`. Mount once, near the root. A new toast replaces the one showing. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hide = () =>
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMessage(null);
      });
    listener = (next) => {
      setMessage(next);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, SHOW_MS);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 8, opacity }]} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={() => setMessage(null)}>
        {message.icon && <Ionicons name={message.icon} size={18} color={theme.colors.primary} />}
        <Text style={styles.text} numberOfLines={2}>{message.text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    elevation: 8,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  text: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
