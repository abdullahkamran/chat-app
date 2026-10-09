import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import type { ActorActionKind } from '@chat-app/shared-types';
import type { ActorState, ChatBubble } from '../../core/contract';
import Bubble from '../legacy/Bubble';
import { CAPSULE_H } from './ActorCapsule';
import { useActorWalk, type ActorMotion } from './actorMotion';
import type { Camera } from './useCamera';

const DEFAULT_BUBBLE_MS = 3500;
/** Wide enough for the widest bubble, so the column can centre over the actor. */
const COLUMN_W = 200;
const HEAD_GAP = 8;

interface QueuedBubble {
  key: string;
  text: string;
}

interface Props {
  actor: ActorState;
  motion: ActorMotion;
  camera: Camera;
  origin: GridOrigin;
  canvasHeight: number;
  onActionComplete: (actorId: string, action: ActorActionKind) => void;
}

/**
 * React Native layer for one actor, drawn over the canvas: drives its walk and shows
 * its chat bubbles and typing indicator. Bubbles follow the actor through the camera
 * transform but stay at a fixed size so text remains readable when zoomed out.
 */
export function ActorOverlay({ actor, motion, camera, origin, canvasHeight, onActionComplete }: Props) {
  useActorWalk(actor, motion, onActionComplete);
  const bubbles = useBubbleQueue(actor.bubbles);

  const style = useAnimatedStyle(() => {
    const feet = gridToScreen(motion.gx.value, motion.gy.value, 0, origin);
    const x = feet.x * camera.scale.value + camera.tx.value;
    const headY = (feet.y - CAPSULE_H) * camera.scale.value + camera.ty.value;
    return { left: x - COLUMN_W / 2, bottom: canvasHeight - headY + HEAD_GAP };
  });

  const duration = actor.user?.attributes?.bubbleDuration ?? DEFAULT_BUBBLE_MS;
  if (!actor.isTyping && bubbles.items.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.column, style]}>
      {actor.isTyping && <Bubble isTyping />}
      {bubbles.items.map(b => (
        <Bubble key={b.key} message={b.text} duration={duration} close={bubbles.closeOldest} />
      ))}
    </Animated.View>
  );
}

let bubbleKey = 0;

/** Turns the actor's append-only message list into a queue of visible bubbles. */
function useBubbleQueue(messages: ChatBubble[]) {
  const [items, setItems] = useState<QueuedBubble[]>([]);
  const seen = useRef(messages.length);

  useEffect(() => {
    const fresh = messages.slice(seen.current);
    seen.current = messages.length;
    if (fresh.length === 0) return;
    setItems(current => [...current, ...fresh.map(m => ({ key: `${bubbleKey++}`, text: m.text }))]);
  }, [messages]);

  const closeOldest = useRef(() => setItems(current => current.slice(1))).current;
  return { items, closeOldest };
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    width: COLUMN_W,
    alignItems: 'center',
    flexDirection: 'column',
    gap: 8,
  },
});
