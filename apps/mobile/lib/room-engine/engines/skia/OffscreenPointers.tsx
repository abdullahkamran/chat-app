import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import UserAvatar from '@/components/UserAvatar';
import { gridToScreen, type GridOrigin } from '@/constants/grid';
import { makeStyles } from '@/constants/theme';
import type { ActorState } from '../../core/contract';
import type { ActorMotion } from './actorMotion';
import { AVATAR_HEIGHT } from './skeleton/humanoidV1';
import { visibleHeight, type CameraRig } from './useCamera';

/** A pointer shows for this long after the person's latest message. */
const POINTER_MS = 6000;
/** Pointer badge size, and how far it sits in from the edge of the room. */
const SIZE = 40;
const EDGE = 30;
const AVATAR = 30;
const NUB = 12;

const useStyles = makeStyles(t => ({
  pointer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Turns with the direction; the nub sits on its right edge, so it points at the speaker.
  spinner: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  nub: {
    width: NUB,
    height: NUB,
    marginRight: -NUB / 2 + 1,
    backgroundColor: t.colors.outline,
    transform: [{ rotate: '45deg' }],
  },
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));

interface Props {
  actors: Readonly<Record<string, ActorState>>;
  localActorId: string;
  motions: ReadonlyMap<string, ActorMotion>;
  rig: CameraRig;
  origin: GridOrigin;
  onFocus: (actorId: string) => void;
}

/**
 * For someone talking out of view: a badge with their initial on the edge of the room,
 * pointing their way. Tapping it shows them. It goes POINTER_MS after their last message,
 * or as soon as they come into view.
 */
export function OffscreenPointers({ actors, localActorId, motions, rig, origin, onFocus }: Readonly<Props>) {
  const [now, setNow] = useState(Date.now);
  const speakers = Object.values(actors).filter(a => {
    if (a.id === localActorId) return false;
    const last = a.bubbles.at(-1);
    return last !== undefined && now - last.sentAt < POINTER_MS;
  });

  // A new message re-renders through `actors`; re-render again when the soonest pointer is due to go.
  const nextExpiry = speakers.length
    ? Math.min(...speakers.map(a => (a.bubbles.at(-1)?.sentAt ?? 0) + POINTER_MS))
    : null;
  useEffect(() => {
    if (nextExpiry === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {speakers.map(a => {
        const motion = motions.get(a.id);
        return motion && (
          <Pointer key={a.id} name={a.user?.username ?? '?'} motion={motion} rig={rig} origin={origin} onPress={() => onFocus(a.id)} />
        );
      })}
    </View>
  );
}

interface PointerProps {
  name: string;
  motion: ActorMotion;
  rig: CameraRig;
  origin: GridOrigin;
  onPress: () => void;
}

function Pointer({ name, motion, rig, origin, onPress }: Readonly<PointerProps>) {
  const styles = useStyles();
  const { camera, inset, width, height } = rig;

  // Where the line from the middle of the visible room to their head leaves it, inset by EDGE.
  const place = useAnimatedStyle(() => {
    const feet = gridToScreen(motion.gx.get(), motion.gy.get(), motion.gz.get(), origin);
    const s = camera.scale.get();
    const visH = visibleHeight(height, inset.get());
    const x = feet.x * s + camera.tx.get();
    const y = (feet.y - AVATAR_HEIGHT * 0.6) * s + camera.ty.get();
    const inView = x > 0 && x < width && y > 0 && y < visH;
    if (inView) return { left: -1000, top: -1000, opacity: 0 };
    const cx = width / 2;
    const cy = visH / 2;
    const dx = x - cx;
    const dy = y - cy;
    const reach = Math.min(
      dx === 0 ? Infinity : (cx - EDGE) / Math.abs(dx),
      dy === 0 ? Infinity : (cy - EDGE) / Math.abs(dy),
    );
    return { left: cx + dx * reach - SIZE / 2, top: cy + dy * reach - SIZE / 2, opacity: 1 };
  });
  const spin = useAnimatedStyle(() => {
    const feet = gridToScreen(motion.gx.get(), motion.gy.get(), motion.gz.get(), origin);
    const s = camera.scale.get();
    const dx = feet.x * s + camera.tx.get() - width / 2;
    const dy = (feet.y - AVATAR_HEIGHT * 0.6) * s + camera.ty.get() - visibleHeight(height, inset.get()) / 2;
    return { transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] };
  });

  return (
    <Animated.View style={[styles.pointer, place]}>
      <Animated.View pointerEvents="none" style={[styles.spinner, spin]}>
        <View style={styles.nub} />
      </Animated.View>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show ${name}`}>
        <View style={styles.badge}>
          <UserAvatar username={name} size={AVATAR} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
