import { useEffect } from "react";
import { Text, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/constants/theme';

interface BubbleProps {
  message: string;
  duration?: number;
  /** When the message was sent (`Date.now()`); the bubble closes `duration` after that, not after it appears. */
  sentAt?: number;
  close?: () => void;
  /** Draw the pointer toward the speaker; only the bubble nearest the head has one. */
  tail?: boolean;
}

/** Side of the square that, turned 45°, forms the speech bubble's tail. */
const TAIL = 10;
/** Diagonal (2, 2) on the turned tail lands straight below it, matching the body's 3 px drop. */
const TAIL_DROP = '2px 2px 0px 0px';
const MAX_WIDTH = 160;

const DOT = 6;
/** One wave of the typing dots: rise, fall, then rest before the next. */
const DOT_RISE_MS = 280;
const DOT_REST_MS = 520;
const DOT_STAGGER_MS = 140;
const DOT_LIFT = 3;

const useStyles = makeStyles(t => ({
  container: {
    alignItems: 'center',
  },
  body: {
    backgroundColor: t.colors.bubble,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs + t.space.xxs,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    maxWidth: MAX_WIDTH,
    ...t.shadows.sticker,
  },
  // A turned square edged on its two lower sides. Its upper half sits over the body's
  // bottom edge, so the two read as one shape with one drop shadow.
  tail: {
    width: TAIL,
    height: TAIL,
    marginTop: -(TAIL / 2 + t.borderWidth.thick),
    backgroundColor: t.colors.bubble,
    borderRightWidth: t.borderWidth.thick,
    borderBottomWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    boxShadow: `${TAIL_DROP} ${t.colors.outline}`,
    transform: [{ rotate: '45deg' }],
  },
  message: {
    ...t.type.label,
    color: t.colors.bubbleText,
    textAlign: 'center',
  },
  thought: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingHorizontal: t.space.sm + t.space.xxs,
    paddingVertical: t.space.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bubble,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    ...t.shadows.sticker,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: t.colors.bubbleTyping,
  },
  // The trail of shrinking puffs from a thought bubble down to the thinker's head.
  puff: {
    backgroundColor: t.colors.bubble,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    ...t.shadows.sticker,
  },
  puffLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: t.space.xs,
    marginLeft: -t.space.md,
  },
  puffSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: t.space.xxs,
    marginLeft: -t.space.xs,
  },
}));

/** A chat message over the speaker's head. Pops in, and fades out `duration` after it was sent. */
export default function Bubble({ message, duration = 3500, sentAt, close, tail = false }: BubbleProps) {
  const t = useTheme();
  const styles = useStyles();

  useEffect(() => {
    if (!close) return;
    const left = sentAt === undefined ? duration : sentAt + duration - Date.now();
    const timer = setTimeout(close, Math.max(0, left));
    return () => clearTimeout(timer);
  }, [close, duration, sentAt]);

  return (
    <Animated.View
      style={styles.container}
      entering={ZoomIn.duration(t.motion.base)}
      exiting={FadeOut.duration(t.motion.fast)}
    >
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
      </View>
      {tail && <View style={styles.tail} />}
    </Animated.View>
  );
}

/** A small thought bubble with three bouncing dots, shown while someone types. */
export function TypingBubble() {
  const t = useTheme();
  const styles = useStyles();

  return (
    <Animated.View
      style={styles.container}
      entering={ZoomIn.duration(t.motion.base)}
      exiting={FadeOut.duration(t.motion.fast)}
    >
      <View style={styles.thought}>
        {[0, 1, 2].map(i => <TypingDot key={i} index={i} />)}
      </View>
      <View style={[styles.puff, styles.puffLarge]} />
      <View style={[styles.puff, styles.puffSmall]} />
    </Animated.View>
  );
}

function TypingDot({ index }: { index: number }) {
  const styles = useStyles();
  const lift = useSharedValue(0);

  useEffect(() => {
    const wave = withSequence(
      withTiming(1, { duration: DOT_RISE_MS }),
      withTiming(0, { duration: DOT_RISE_MS }),
      withTiming(0, { duration: DOT_REST_MS }),
    );
    lift.set(withDelay(index * DOT_STAGGER_MS, withRepeat(wave, -1)));
  }, [index, lift]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * lift.get(),
    transform: [{ translateY: -DOT_LIFT * lift.get() }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}
