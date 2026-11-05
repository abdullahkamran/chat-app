import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';

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

const useStyles = makeStyles(t => ({
  wrap: {
    position: 'absolute',
    left: t.space.lg,
    right: t.space.lg,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    ...t.shadows.floating,
  },
  text: {
    flexShrink: 1,
  },
}));

/** Renders toasts from `showToast`. Mount once, near the root. A new toast replaces the one showing. */
export function ToastHost() {
  const t = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hide = () =>
      Animated.timing(opacity, { toValue: 0, duration: t.motion.base, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMessage(null);
      });
    listener = (next) => {
      setMessage(next);
      Animated.timing(opacity, { toValue: 1, duration: t.motion.base, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, SHOW_MS);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity, t.motion.base]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 8, opacity }]} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={() => setMessage(null)}>
        {message.icon && <Ionicons name={message.icon} size={18} color={t.colors.primary} />}
        <AppText variant="label" style={styles.text} numberOfLines={2}>{message.text}</AppText>
      </Pressable>
    </Animated.View>
  );
}
