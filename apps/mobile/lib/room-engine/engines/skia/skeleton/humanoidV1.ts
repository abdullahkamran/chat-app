import { HUMANOID_V1, type BoneName, type RigView } from '@chat-app/shared-types';

export { HUMANOID_V1 };

/** Avatar height in content pixels at zoom 1 (feet to top of head): two tile heights. */
export const AVATAR_HEIGHT = 80;

const BONES = HUMANOID_V1.bones;

export const BONE_COUNT = BONES.length;

/** Index of each bone in `HUMANOID_V1.bones`. */
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b.name, i])) as Record<BoneName, number>;

/**
 * Flat bind-pose arrays for the UI-thread solver. Parents precede children, so one
 * forward pass builds world transforms. The back view mirrors the bind x offsets
 * (the avatar's left side is on screen left when seen from behind); rotations keep
 * their meaning, so "forward" stays towards screen right in both views.
 */
export interface RigArrays {
  parent: number[];
  bindX: Record<RigView, number[]>;
  bindY: number[];
  bindRotation: number[];
}

export const RIG_ARRAYS: RigArrays = {
  parent: BONES.map(b => (b.parent ? BONE_INDEX[b.parent] : -1)),
  bindX: { front: BONES.map(b => b.x), back: BONES.map(b => -b.x) },
  bindY: BONES.map(b => b.y),
  bindRotation: BONES.map(b => b.rotation),
};
