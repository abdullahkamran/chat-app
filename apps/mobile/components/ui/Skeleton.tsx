import { useEffect, type ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useTheme, type Theme, type ThemeColors } from '@/constants/theme';

/** One pulse, out and back. */
const PULSE_MS = 900;

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  /** A radius token, or `circle` for round shapes (avatars). Defaults to `md`. */
  radius?: keyof Theme['radius'] | 'circle';
  /** Fill color. Defaults to `skeleton`; use `border` when it sits on `surfaceElevated`. */
  color?: keyof ThemeColors;
  style?: StyleProp<ViewStyle>;
}

/**
 * A pulsing placeholder in the shape of content that's still loading. Build a screen's
 * loading state from these laid out like the real thing, inside a `SkeletonGroup`.
 */
export function Skeleton({ width = '100%', height = 16, radius = 'md', color = 'skeleton', style }: Readonly<Props>) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.45, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const r = radius === 'circle' ? 9999 : t.radius[radius];

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: r, backgroundColor: t.colors[color] }, pulse, style]}
    />
  );
}

/**
 * Wraps a screen's or section's skeletons so screen readers hear "Loading" once instead of
 * nothing (the shapes themselves are hidden from them).
 */
export function SkeletonGroup({ children, style, label = 'Loading' }: Readonly<{ children: ReactNode; style?: StyleProp<ViewStyle>; label?: string }>) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={style}>
      {children}
    </View>
  );
}
