import { Skia, type SkColor } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/constants/theme';

/** One pulse, out and back: the same beat as the `Skeleton` primitive. */
const PULSE_MS = 900;
const STEPS = 16;

/**
 * The loading ghost's colour over one half pulse, from bright to dim. The pulse moves
 * between two opaque colours instead of fading the avatar's opacity, so the overlapping
 * body parts never show through each other.
 */
export type GhostColors = SkColor[];

/** The ghost's colours in the current theme; a single still colour with reduced motion on. */
export function useGhostColors(): GhostColors {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  return useMemo(() => {
    const from = Skia.Color(t.colors.avatarLoading);
    if (reduceMotion) return [from];
    const to = Skia.Color(t.colors.avatarLoadingDim);
    return Array.from({ length: STEPS }, (_, i) => {
      const u = i / (STEPS - 1);
      return Float32Array.from(from, (c, k) => c + (to[k] - c) * u);
    });
  }, [t, reduceMotion]);
}

/** The ghost colour at a time in milliseconds (any steady clock): eased out to dim and back. */
export function ghostColorAt(colors: GhostColors, timeMs: number): SkColor {
  'worklet';
  const phase = (timeMs % (2 * PULSE_MS)) / PULSE_MS;
  const u = phase <= 1 ? phase : 2 - phase;
  const eased = u * u * (3 - 2 * u);
  return colors[Math.round(eased * (colors.length - 1))];
}
