import { useEffect, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  makeMutable,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ActorActionKind } from '@chat-app/shared-types';
import type { ActorState } from '../../core/contract';

/** Default walking pace in ms per grid cell, when the user has no speed attribute. */
const DEFAULT_MS_PER_CELL = 500;
const MIN_SEGMENT_MS = 50;

/** An actor's on-screen grid position, animated on the UI thread. Lags the logical position while walking. */
export interface ActorMotion {
  gx: SharedValue<number>;
  gy: SharedValue<number>;
}

/**
 * Shared values per actor id, so the canvas (capsules) and the RN overlay (bubbles)
 * read the same animated position. Entries for actors that left are dropped.
 */
export function useActorMotions(actors: Readonly<Record<string, ActorState>>) {
  const store = useRef(new Map<string, ActorMotion>()).current;

  for (const actor of Object.values(actors)) {
    if (!store.has(actor.id)) {
      store.set(actor.id, {
        gx: makeMutable(actor.position.x),
        gy: makeMutable(actor.position.y),
      });
    }
  }

  useEffect(() => {
    for (const [id, motion] of store) {
      if (actors[id]) continue;
      cancelAnimation(motion.gx);
      cancelAnimation(motion.gy);
      store.delete(id);
    }
  }, [actors, store]);

  return store;
}

/**
 * Plays the actor's current action on its motion values.
 * A walk runs through every path point at constant speed, then reports completion.
 * Any other action snaps to the logical position if the two have drifted.
 */
export function useActorWalk(
  actor: ActorState,
  motion: ActorMotion,
  onActionComplete: (actorId: string, action: ActorActionKind) => void,
) {
  const onCompleteRef = useRef(onActionComplete);
  onCompleteRef.current = onActionComplete;

  const { id, action, position } = actor;
  const msPerCell = actor.user?.attributes?.speed ?? DEFAULT_MS_PER_CELL;

  useEffect(() => {
    const complete = (actorId: string) => onCompleteRef.current(actorId, 'walk');

    if (action.kind !== 'walk') {
      if (motion.gx.value !== position.x || motion.gy.value !== position.y) {
        cancelAnimation(motion.gx);
        cancelAnimation(motion.gy);
        motion.gx.value = position.x;
        motion.gy.value = position.y;
      }
      return;
    }

    if (action.path.length === 0) {
      complete(id);
      return;
    }

    // Start from where the actor is drawn now, so a new destination mid-walk doesn't jump.
    let from = { x: motion.gx.value, y: motion.gy.value };
    const xs = [];
    const ys = [];
    for (const [i, point] of action.path.entries()) {
      const duration = Math.max(MIN_SEGMENT_MS, Math.hypot(point.x - from.x, point.y - from.y) * msPerCell);
      const config = { duration, easing: Easing.linear };
      const isLast = i === action.path.length - 1;
      xs.push(withTiming(point.x, config, finished => {
        // Interrupted walks (a new destination arrived) don't complete.
        if (isLast && finished) scheduleOnRN(complete, id);
      }));
      ys.push(withTiming(point.y, config));
      from = point;
    }
    motion.gx.value = withSequence(...xs);
    motion.gy.value = withSequence(...ys);
  }, [id, action, position.x, position.y, msPerCell, motion]);
}
