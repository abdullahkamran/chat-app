import { useState } from 'react';

import { Facing, type ActorActionKind, type Dimensions, type User } from '@chat-app/shared-types';
import type { ActorState } from '../../core/contract';
import { facingFromDelta } from '../../core/facing';

// Inlined by Expo at bundle time; restart Metro with -c after changing it.
const requested = Number(process.env.EXPO_PUBLIC_ROOM_STRESS_ACTORS ?? 0);
/** Synthetic avatars to add in dev builds, for the 30-avatar performance check. */
export const STRESS_ACTOR_COUNT = __DEV__ && Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : 0;

const ID_PREFIX = 'stress-';

function randomPoint(dims: Pick<Dimensions, 'x' | 'y'>) {
  return { x: Math.random() * dims.x, y: Math.random() * dims.y, z: 0 };
}

function wander(actor: ActorState, dims: Pick<Dimensions, 'x' | 'y'>): ActorState {
  const to = randomPoint(dims);
  return {
    ...actor,
    position: to,
    facing: facingFromDelta(to.x - actor.position.x, to.y - actor.position.y),
    action: { kind: 'walk', path: [to] },
  };
}

function spawn(count: number, dims: Pick<Dimensions, 'x' | 'y'>): Record<string, ActorState> {
  const actors: Record<string, ActorState> = {};
  for (let i = 0; i < count; i++) {
    const id = `${ID_PREFIX}${i}`;
    const idle: ActorState = {
      id,
      user: { _id: id, attributes: { speed: 350 + Math.random() * 350 } } as unknown as User,
      position: randomPoint(dims),
      facing: Facing.SE,
      action: { kind: 'idle' },
      bubbles: [],
      isTyping: false,
    };
    actors[id] = wander(idle, dims);
  }
  return actors;
}

/**
 * Dev-only load test: adds STRESS_ACTOR_COUNT engine-local avatars that walk to a new
 * random spot whenever they arrive. They never reach the session or the socket.
 */
export function useStressActors(
  actors: Readonly<Record<string, ActorState>>,
  dims: Pick<Dimensions, 'x' | 'y'>,
  onActionComplete: (actorId: string, action: ActorActionKind) => void,
) {
  const [fake, setFake] = useState(() => spawn(STRESS_ACTOR_COUNT, dims));

  if (STRESS_ACTOR_COUNT === 0) return { actors, onActionComplete };

  const handleComplete = (actorId: string, action: ActorActionKind) => {
    if (!actorId.startsWith(ID_PREFIX)) {
      onActionComplete(actorId, action);
      return;
    }
    setFake(current => {
      const actor = current[actorId];
      return actor ? { ...current, [actorId]: wander(actor, dims) } : current;
    });
  };

  return { actors: { ...actors, ...fake }, onActionComplete: handleComplete };
}
