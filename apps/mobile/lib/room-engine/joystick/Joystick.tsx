import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles } from '@/constants/theme';
import { STICK_REST, type StickVector } from './steerMath';

/**
 * Diameter of the base ring and of the knob, in px. The ring sits EDGE px in from the
 * room's bottom-right corner: 76 + 12 keeps it clear of the chat peek (right: 88) and
 * under the postbox and edit buttons (bottom: 100).
 */
const BASE = 76;
const KNOB = 34;
const EDGE = 12;
/** How far the knob's centre can leave the base's centre. */
const TRAVEL = (BASE - KNOB) / 2;
/** Touches nearer the centre than this don't move the actor, so resting a thumb is safe. */
const DEAD_ZONE = 8;
/** Touch area around the ring (padding, which works on Android where hitSlop doesn't), so a thumb landing near it still catches it. */
const SLOP = 20;
const IDLE_OPACITY = 0.55;

const useStyles = makeStyles(t => ({
  zone: {
    position: 'absolute',
    right: EDGE - SLOP,
    bottom: EDGE - SLOP,
    padding: SLOP,
  },
  base: {
    width: BASE,
    height: BASE,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.primary,
    ...t.shadows.sticker,
  },
}));

function grabbed() {
  Haptics.selectionAsync().catch(() => {});
}

interface Props {
  /** Written with the push direction (unit length) while held outside the dead zone, else STICK_REST. */
  stick: SharedValue<StickVector>;
}

/**
 * Fixed thumbstick for the room's bottom-right corner; render it inside the room area.
 * Direction comes from where the thumb is relative to the
 * ring's centre, not where it first landed, so it always points where the thumb is.
 * Speed is constant past the dead zone, like tap-to-walk.
 */
export function Joystick({ stick }: Readonly<Props>) {
  const styles = useStyles();
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);
  const held = useSharedValue(0);

  const gesture = useMemo(() => {
    const aim = (x: number, y: number) => {
      'worklet';
      // Event coordinates are relative to the touch zone; the ring's centre is SLOP in.
      const dx = x - SLOP - BASE / 2;
      const dy = y - SLOP - BASE / 2;
      const len = Math.hypot(dx, dy);
      const k = len > TRAVEL ? TRAVEL / len : 1;
      knobX.set(dx * k);
      knobY.set(dy * k);
      stick.set(len < DEAD_ZONE ? STICK_REST : { x: dx / len, y: dy / len });
    };
    return Gesture.Pan()
      .minDistance(0)
      .onBegin(e => {
        held.set(withTiming(1, { duration: 120 }));
        aim(e.x, e.y);
        scheduleOnRN(grabbed);
      })
      .onUpdate(e => aim(e.x, e.y))
      .onFinalize(() => {
        stick.set(STICK_REST);
        knobX.set(withSpring(0, { damping: 14, stiffness: 260 }));
        knobY.set(withSpring(0, { damping: 14, stiffness: 260 }));
        held.set(withTiming(0, { duration: 200 }));
      });
  }, [stick, knobX, knobY, held]);

  // Hidden mid-push (edit mode, a panel opening): the stick must not stay pushed.
  useEffect(() => () => stick.set(STICK_REST), [stick]);

  const baseStyle = useAnimatedStyle(() => ({
    opacity: IDLE_OPACITY + (1 - IDLE_OPACITY) * held.get(),
    transform: [{ scale: 1 + 0.06 * held.get() }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.get() }, { translateY: knobY.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.zone} accessibilityLabel="Movement joystick" accessibilityHint="Hold and drag to walk">
        <Animated.View style={[styles.base, baseStyle]} pointerEvents="none">
          <Animated.View style={[styles.knob, knobStyle]} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
