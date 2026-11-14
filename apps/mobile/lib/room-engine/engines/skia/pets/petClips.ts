import type { ClipEase, ClipKey, PetKind } from '@chat-app/shared-types';
import type { PetClip } from '../../../core/pets';

/**
 * Hand-written pet clips, the same way as the avatars' (skeleton/clips.ts).
 *
 * Angles are clockwise degrees on screen with the pet facing screen right, so a negative
 * angle lifts the front of a bone that points right, and swings a leg (pointing down)
 * forward. Translations are pixels in the parent's frame. Cats and dogs share the
 * quadruped clips; each kind fills in clips it doesn't have from FALLBACK.
 */

export interface PetTrack {
  rotate?: ClipKey<number>[];
  translate?: ClipKey<[number, number]>[];
}

export interface PetClipDef {
  /** Seconds. */
  duration: number;
  loop: boolean;
  tracks: Record<string, PetTrack>;
}

/** Keys at `times` with `values`, each easing the same way to the next. */
function keys<V extends number | [number, number]>(times: number[], values: V[], ease: ClipEase = 'inOut'): ClipKey<V>[] {
  return times.map((t, i) => ({ t, v: values[i], ease }));
}

/** One unchanging value for the whole clip. */
const hold = <V extends number | [number, number]>(v: V): ClipKey<V>[] => [{ t: 0, v }];

function clip(duration: number, loop: boolean, tracks: Record<string, PetTrack>): PetClipDef {
  return { duration, loop, tracks };
}

/** `base`'s tracks with `over`'s replacing them bone by bone and channel by channel. */
function over(base: PetClipDef, duration: number, loop: boolean, tracks: Record<string, PetTrack>): PetClipDef {
  const merged: Record<string, PetTrack> = {};
  for (const bone of new Set([...Object.keys(base.tracks), ...Object.keys(tracks)])) {
    merged[bone] = { ...base.tracks[bone], ...tracks[bone] };
  }
  return clip(duration, loop, merged);
}

// ── Quadrupeds (cat, dog) ─────────────────────────────────────────────────────

const QUAD_IDLE = clip(3, true, {
  body: { translate: keys([0, 1.5, 3], [[0, 0], [0, 0.4], [0, 0]]) },
  head: { rotate: keys([0, 1, 1.4, 2.4, 2.8, 3], [0, 0, -10, -10, 0, 0]) },
  tail: { rotate: keys([0, 1.5, 3], [0, 12, 0]) },
  tailTip: { rotate: keys([0, 1.5, 3], [0, -15, 0]) },
});

/** Diagonal pairs move together: near front with far back, far front with near back. */
const QUAD_WALK = clip(0.6, true, {
  body: { translate: keys([0, 0.15, 0.3, 0.45, 0.6], [[0, 0], [0, -0.8], [0, 0], [0, -0.8], [0, 0]]) },
  head: { rotate: keys([0, 0.3, 0.6], [-2, 2, -2]) },
  tail: { rotate: keys([0, 0.3, 0.6], [-15, -5, -15]) },
  tailTip: { rotate: keys([0, 0.3, 0.6], [5, -5, 5]) },
  legNearFront: { rotate: keys([0, 0.3, 0.6], [-25, 25, -25]) },
  legFarBack: { rotate: keys([0, 0.3, 0.6], [-25, 25, -25]) },
  legFarFront: { rotate: keys([0, 0.3, 0.6], [25, -25, 25]) },
  legNearBack: { rotate: keys([0, 0.3, 0.6], [25, -25, 25]) },
});

/** A gallop: front legs together, back legs together, the body rocking. */
const QUAD_RUN = clip(0.4, true, {
  body: {
    rotate: keys([0, 0.2, 0.4], [-5, 5, -5]),
    translate: keys([0, 0.1, 0.2, 0.3, 0.4], [[0, 0], [0, -2.5], [0, 0], [0, -2.5], [0, 0]]),
  },
  head: { rotate: keys([0, 0.2, 0.4], [5, -5, 5]) },
  tail: { rotate: hold(-50) },
  tailTip: { rotate: keys([0, 0.2, 0.4], [-10, 10, -10]) },
  legNearFront: { rotate: keys([0, 0.2, 0.4], [-45, 35, -45]) },
  legFarFront: { rotate: keys([0, 0.2, 0.4], [-40, 40, -40]) },
  legNearBack: { rotate: keys([0, 0.2, 0.4], [35, -45, 35]) },
  legFarBack: { rotate: keys([0, 0.2, 0.4], [40, -40, 40]) },
});

/**
 * Sitting up: the body tips back 25°, its back end on the ground. Back legs fold forward
 * along the floor (world -90°, so -65° under the tipped body); front legs stay upright.
 */
const QUAD_SIT = clip(3, true, {
  body: { rotate: hold(-25), translate: hold([-1, 4]) },
  neck: { rotate: hold(18) },
  head: { rotate: keys([0, 1.2, 1.6, 2.6, 3], [6, 6, -4, -4, 6]) },
  tail: { rotate: hold(-75) },
  tailTip: { rotate: keys([0, 1.5, 3], [10, 30, 10]) },
  legNearFront: { rotate: hold(25) },
  legFarFront: { rotate: hold(25) },
  legNearBack: { rotate: hold(-65) },
  legFarBack: { rotate: hold(-65) },
});

/** Curled up on the floor, head down at the front, breathing slowly. */
const QUAD_SLEEP = clip(4, true, {
  body: { translate: keys([0, 2, 4], [[0, 6], [0, 6.6], [0, 6]]) },
  neck: { rotate: hold(50) },
  head: { rotate: hold(-35) },
  tail: { rotate: hold(-105) },
  tailTip: { rotate: hold(-45) },
  legNearFront: { rotate: hold(-85) },
  legFarFront: { rotate: hold(-80) },
  legNearBack: { rotate: hold(-85) },
  legFarBack: { rotate: hold(-80) },
});

/** Cat: sitting, licking a paw held up to its mouth. */
const CAT_GROOM = over(QUAD_SIT, 1.4, true, {
  neck: { rotate: hold(35) },
  head: { rotate: keys([0, 0.35, 0.7, 1.05, 1.4], [10, 28, 10, 28, 10]) },
  legNearFront: { rotate: keys([0, 0.7, 1.4], [-120, -132, -120]) },
});

/** Cat: a meow, head lifted and held. */
const CAT_SPEAK = over(QUAD_SIT, 1.2, false, {
  neck: { rotate: keys([0, 0.15, 0.8, 1.2], [18, 0, 0, 18]) },
  head: { rotate: keys([0, 0.15, 0.8, 1.2], [6, -22, -22, 6]) },
});

/** Cat: front legs out, chest down, tail up, then back. */
const CAT_STRETCH = clip(2, false, {
  body: { rotate: keys([0, 0.5, 1.5, 2], [0, 14, 14, 0]), translate: keys([0, 0.5, 1.5, 2], [[0, 0], [1, 2], [1, 2], [0, 0]]) },
  head: { rotate: keys([0, 0.5, 1.5, 2], [0, -18, -18, 0]) },
  tail: { rotate: keys([0, 0.5, 1.5, 2], [0, 20, 20, 0]) },
  legNearFront: { rotate: keys([0, 0.5, 1.5, 2], [0, -70, -70, 0]) },
  legFarFront: { rotate: keys([0, 0.5, 1.5, 2], [0, -65, -65, 0]) },
});

/** Dog: two quick barks. */
const DOG_SPEAK = clip(1.2, false, {
  body: { translate: keys([0, 0.1, 0.25, 0.4, 0.55], [[0, 0], [0, -1], [0, 0], [0, -1], [0, 0]]) },
  neck: { rotate: keys([0, 0.1, 0.25, 0.4, 0.55], [0, -12, 0, -12, 0]) },
  head: { rotate: keys([0, 0.1, 0.25, 0.4, 0.55], [0, -18, 0, -18, 0]) },
  tail: { rotate: keys([0, 0.6, 1.2], [20, 30, 20]) },
});

/** Dog: standing, tail going, looking up hopefully. */
const DOG_WAG = clip(0.5, true, {
  body: { translate: keys([0, 0.25, 0.5], [[0, 0], [0, -0.5], [0, 0]]) },
  head: { rotate: hold(-8) },
  tail: { rotate: keys([0, 0.125, 0.25, 0.375, 0.5], [25, -5, 25, -5, 25]) },
  tailTip: { rotate: keys([0, 0.125, 0.25, 0.375, 0.5], [-10, 10, -10, 10, -10]) },
});

/** Dog: sitting, a back leg scratching behind the ear. */
const DOG_SCRATCH = over(QUAD_SIT, 2, false, {
  neck: { rotate: hold(30) },
  head: { rotate: hold(20) },
  legNearBack: { rotate: keys([0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8], [-65, -150, -125, -150, -125, -150, -125, -150, -125, -150, -125, -150, -125, -150, -125, -150, -65]) },
});

// ── Bird ──────────────────────────────────────────────────────────────────────

const BIRD_IDLE = clip(2.4, true, {
  body: { translate: keys([0, 1.2, 2.4], [[0, 0], [0, 0.3], [0, 0]]) },
  head: { rotate: keys([0, 0.6, 0.7, 1.4, 1.5, 2.3, 2.4], [0, 0, -15, -15, 10, 10, 0], 'linear') },
  tail: { rotate: keys([0, 1.2, 2.4], [0, -6, 0]) },
});

/** Little two-footed hops; walking and running are hops too. */
const BIRD_HOP = clip(0.4, true, {
  body: { translate: keys([0, 0.1, 0.2, 0.3, 0.4], [[0, 0], [0, -4], [0, -5], [0, -2], [0, 0]]) },
  legNear: { rotate: keys([0, 0.2, 0.4], [0, 25, 0]) },
  legFar: { rotate: keys([0, 0.2, 0.4], [0, 25, 0]) },
  tail: { rotate: keys([0, 0.2, 0.4], [0, 10, 0]) },
  wingNear: { rotate: keys([0, 0.2, 0.4], [0, 15, 0]) },
});

/** Flapping, legs tucked back, nose up a little. */
const BIRD_FLY = clip(0.3, true, {
  body: { rotate: hold(-10), translate: keys([0, 0.15, 0.3], [[0, 0], [0, 1], [0, 0]]) },
  wingNear: { rotate: keys([0, 0.15, 0.3], [60, -25, 60]) },
  wingFar: { rotate: keys([0, 0.15, 0.3], [55, -20, 55]) },
  legNear: { rotate: hold(70) },
  legFar: { rotate: hold(70) },
  tail: { rotate: hold(12) },
});

/** Leaning in and pecking at the floor. */
const BIRD_PECK = clip(1.6, true, {
  body: { rotate: keys([0, 0.2, 0.65, 1.6], [0, 20, 0, 0]) },
  head: {
    rotate: keys([0, 0.2, 0.35, 0.5, 0.65, 1.6], [0, 60, 40, 60, 0, 0]),
    translate: keys([0, 0.2, 0.65, 1.6], [[0, 0], [2, 3], [0, 0], [0, 0]]),
  },
  tail: { rotate: keys([0, 0.2, 0.65, 1.6], [0, -20, 0, 0]) },
});

/** Preening: head turned back into the wing. */
const BIRD_GROOM = clip(1.2, true, {
  head: {
    rotate: keys([0, 0.3, 0.6, 0.9, 1.2], [150, 165, 150, 165, 150]),
    translate: hold([-5, 2]),
  },
  wingNear: { rotate: keys([0, 0.6, 1.2], [0, 12, 0]) },
});

/** A chirp: head up twice. */
const BIRD_SPEAK = clip(1.2, false, {
  body: { translate: keys([0, 0.1, 0.3, 0.4, 0.6], [[0, 0], [0, -1], [0, 0], [0, -1], [0, 0]]) },
  head: { rotate: keys([0, 0.1, 0.3, 0.4, 0.6, 1.2], [0, -25, -8, -25, 0, 0]) },
  tail: { rotate: keys([0, 0.1, 0.3, 0.4, 0.6], [0, 10, 0, 10, 0]) },
});

/** Fluffed up, head tucked down into the body. */
const BIRD_SLEEP = clip(4, true, {
  body: { translate: keys([0, 2, 4], [[0, 1.5], [0, 2], [0, 1.5]]) },
  head: { rotate: hold(25), translate: hold([-3, 4]) },
  tail: { rotate: hold(-5) },
});

// ── Per kind ──────────────────────────────────────────────────────────────────

type ClipSet = Partial<Record<PetClip, PetClipDef>>;

export const PET_CLIP_DEFS: Record<PetKind, ClipSet> = {
  cat: {
    idle: QUAD_IDLE, walk: QUAD_WALK, run: QUAD_RUN, sit: QUAD_SIT, sleep: QUAD_SLEEP,
    groom: CAT_GROOM, speak: CAT_SPEAK, stretch: CAT_STRETCH,
  },
  dog: {
    idle: QUAD_IDLE, walk: QUAD_WALK, run: QUAD_RUN, sit: QUAD_SIT, sleep: QUAD_SLEEP,
    speak: DOG_SPEAK, wag: DOG_WAG, scratch: DOG_SCRATCH,
  },
  bird: {
    idle: BIRD_IDLE, hop: BIRD_HOP, walk: BIRD_HOP, run: BIRD_HOP, fly: BIRD_FLY,
    peck: BIRD_PECK, groom: BIRD_GROOM, speak: BIRD_SPEAK, sleep: BIRD_SLEEP,
  },
};

/** What a kind plays for a clip it doesn't have. */
export const FALLBACK: Record<PetClip, PetClip> = {
  idle: 'idle', walk: 'idle', run: 'walk', sit: 'idle', sleep: 'idle', groom: 'idle', speak: 'idle',
  stretch: 'idle', wag: 'idle', scratch: 'sit', hop: 'walk', fly: 'walk', peck: 'idle',
};

export const ALL_PET_CLIPS = Object.keys(FALLBACK) as PetClip[];
