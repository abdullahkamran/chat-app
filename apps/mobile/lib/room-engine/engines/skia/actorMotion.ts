import { useEffect, useEffectEvent, useState } from 'react';
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

type Actors = Readonly<Record<string, ActorState>>;

/** Keep motions for actors still present, create them for newcomers. Returns `prev` when nothing changed. */
function syncMotions(prev: ReadonlyMap<string, ActorMotion>, actors: Actors): ReadonlyMap<string, ActorMotion> {
  const list = Object.values(actors);
  if (list.length === prev.size && list.every(a => prev.has(a.id))) return prev;
  return new Map(list.map(a => [
    a.id,
    prev.get(a.id) ?? { gx: makeMutable(a.position.x), gy: makeMutable(a.position.y) },
  ]));
}

/**
 * Shared values per actor id, so the canvas (capsules) and the RN overlay (bubbles)
 * read the same animated position. Synced during render (React's "adjust state when
 * a prop changes" pattern) so a new actor has a motion on its first frame.
 */
export function useActorMotions(actors: Actors): ReadonlyMap<string, ActorMotion> {
  const [state, setState] = useState(() => ({ actors, motions: syncMotions(new Map(), actors) }));
  if (state.actors !== actors) {
    const motions = syncMotions(state.motions, actors);
    setState({ actors, motions });
    return motions;
  }
  return state.motions;
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
  const onWalkDone = useEffectEvent((actorId: string) => onActionComplete(actorId, 'walk'));

  const { id, action, position } = actor;
  const msPerCell = actor.user?.attributes?.speed ?? DEFAULT_MS_PER_CELL;

  useEffect(() => {
    const { gx, gy } = motion;
    const complete = (actorId: string) => onWalkDone(actorId);

    if (action.kind !== 'walk') {
      if (gx.get() !== position.x || gy.get() !== position.y) {
        cancelAnimation(gx);
        cancelAnimation(gy);
        gx.set(position.x);
        gy.set(position.y);
      }
      return;
    }

    if (action.path.length === 0) {
      complete(id);
      return;
    }

    // Start from where the actor is drawn now, so a new destination mid-walk doesn't jump.
    const starts = [{ x: gx.get(), y: gy.get() }, ...action.path];
    const segments = action.path.map((point, i) => ({
      point,
      config: {
        duration: Math.max(MIN_SEGMENT_MS, Math.hypot(point.x - starts[i].x, point.y - starts[i].y) * msPerCell),
        easing: Easing.linear,
      },
    }));
    const last = segments.length - 1;

    gx.set(withSequence(...segments.map(({ point, config }, i) =>
      withTiming(point.x, config, finished => {
        // Interrupted walks (a new destination arrived) don't complete.
        if (i === last && finished) scheduleOnRN(complete, id);
      }),
    )));
    gy.set(withSequence(...segments.map(({ point, config }) => withTiming(point.y, config))));
  }, [id, action, position.x, position.y, msPerCell, motion]);

  // Stop any running walk when the actor leaves.
  useEffect(() => () => {
    cancelAnimation(motion.gx);
    cancelAnimation(motion.gy);
  }, [motion]);
}
