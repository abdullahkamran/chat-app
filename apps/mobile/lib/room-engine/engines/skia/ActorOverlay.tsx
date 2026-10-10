import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import type { ActorActionKind } from '@chat-app/shared-types';
import type { ActorState, ChatBubble } from '../../core/contract';
import Bubble from '../legacy/Bubble';
import { AVATAR_HEIGHT } from './skeleton/humanoidV1';
import { useActorWalk, type ActorMotion } from './actorMotion';
import type { Camera } from './useCamera';

const DEFAULT_BUBBLE_MS = 3500;
/** Wide enough for the widest bubble, so the column can centre over the actor. */
const COLUMN_W = 200;
const HEAD_GAP = 8;

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
    const feet = gridToScreen(motion.gx.get(), motion.gy.get(), 0, origin);
    const scale = camera.scale.get();
    const x = feet.x * scale + camera.tx.get();
    const headY = (feet.y - AVATAR_HEIGHT) * scale + camera.ty.get();
    return { left: x - COLUMN_W / 2, bottom: canvasHeight - headY + HEAD_GAP };
  });

  const duration = actor.user?.attributes?.bubbleDuration ?? DEFAULT_BUBBLE_MS;
  if (!actor.isTyping && bubbles.items.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.column, style]}>
      {actor.isTyping && <Bubble isTyping />}
      {bubbles.items.map(b => (
        <Bubble key={b.id} message={b.text} duration={duration} close={bubbles.closeOldest} />
      ))}
    </Animated.View>
  );
}

/** Turns the actor's append-only message list into a queue of visible bubbles. */
function useBubbleQueue(messages: ChatBubble[]) {
  // Messages already present on mount are history, not new bubbles.
  const [state, setState] = useState(() => ({ seen: messages.length, items: [] as ChatBubble[] }));
  let current = state;
  if (messages.length !== state.seen) {
    // Shorter means the list was reset; only show what arrived since.
    const fresh = messages.length > state.seen ? messages.slice(state.seen) : [];
    current = { seen: messages.length, items: [...state.items, ...fresh] };
    setState(current);
  }

  const closeOldest = useCallback(() => setState(s => ({ ...s, items: s.items.slice(1) })), []);
  return { items: current.items, closeOldest };
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
