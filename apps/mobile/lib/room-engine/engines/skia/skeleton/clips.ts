import type { AnimationClip, BoneTrack, BoneName, RigView } from '@chat-app/shared-types';

/**
 * Hand-written clips for humanoid-v1 (no animation editor; decided 2026-10-10).
 *
 * Angles are degrees relative to the bind pose, clockwise on screen. Both views face
 * screen right before mirroring, so swinging a limb forward is a negative angle.
 * The programmer-art avatar moves the same way in both views, so `back` reuses the
 * `front` tracks; real art may need its own back-view keys.
 */

/**
 * One stride is 0.8 s and covers 1.6 cells at the default 500 ms per cell.
 * Left foot strikes at 0, right foot at 0.4. Knees bend most while each leg swings
 * through (left at 0.5, right at 0.1); arms swing opposite the legs.
 */
const WALK_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    // A swung leg reaches less far down than a straight one, so the hip drops to keep the
    // planted foot on the ground: lowest on each foot strike, a little higher while passing.
    translate: [
      { t: 0, v: [0, 2.5], ease: 'inOut' },
      { t: 0.2, v: [0, 1.5], ease: 'inOut' },
      { t: 0.4, v: [0, 2.5], ease: 'inOut' },
      { t: 0.6, v: [0, 1.5], ease: 'inOut' },
      { t: 0.8, v: [0, 2.5] },
    ],
  },
  chest: {
    rotate: [
      { t: 0, v: -3, ease: 'inOut' },
      { t: 0.4, v: 3, ease: 'inOut' },
      { t: 0.8, v: -3 },
    ],
  },
  'thigh.L': {
    rotate: [
      { t: 0, v: -25, ease: 'inOut' },
      { t: 0.4, v: 20, ease: 'inOut' },
      { t: 0.8, v: -25 },
    ],
  },
  'shin.L': {
    rotate: [
      { t: 0, v: 5 },
      { t: 0.1, v: 10 },
      { t: 0.3, v: 5 },
      { t: 0.5, v: 45 },
      { t: 0.65, v: 30 },
      { t: 0.8, v: 5 },
    ],
  },
  'foot.L': {
    rotate: [
      { t: 0, v: -10 },
      { t: 0.3, v: 0 },
      { t: 0.45, v: 25 },
      { t: 0.65, v: 0 },
      { t: 0.8, v: -10 },
    ],
  },
  'thigh.R': {
    rotate: [
      { t: 0, v: 20, ease: 'inOut' },
      { t: 0.4, v: -25, ease: 'inOut' },
      { t: 0.8, v: 20 },
    ],
  },
  // shin.L shifted by half a stride.
  'shin.R': {
    rotate: [
      { t: 0, v: 25 },
      { t: 0.1, v: 45 },
      { t: 0.25, v: 30 },
      { t: 0.4, v: 5 },
      { t: 0.5, v: 10 },
      { t: 0.7, v: 5 },
      { t: 0.8, v: 25 },
    ],
  },
  'foot.R': {
    rotate: [
      { t: 0, v: 10 },
      { t: 0.05, v: 25 },
      { t: 0.25, v: 0 },
      { t: 0.4, v: -10 },
      { t: 0.7, v: 0 },
      { t: 0.8, v: 10 },
    ],
  },
  'upperArm.L': {
    rotate: [
      { t: 0, v: 18, ease: 'inOut' },
      { t: 0.4, v: -18, ease: 'inOut' },
      { t: 0.8, v: 18 },
    ],
  },
  'foreArm.L': {
    rotate: [
      { t: 0, v: -5, ease: 'inOut' },
      { t: 0.4, v: -25, ease: 'inOut' },
      { t: 0.8, v: -5 },
    ],
  },
  'upperArm.R': {
    rotate: [
      { t: 0, v: -18, ease: 'inOut' },
      { t: 0.4, v: 18, ease: 'inOut' },
      { t: 0.8, v: -18 },
    ],
  },
  'foreArm.R': {
    rotate: [
      { t: 0, v: -25, ease: 'inOut' },
      { t: 0.4, v: -5, ease: 'inOut' },
      { t: 0.8, v: -25 },
    ],
  },
};

/** Slow breathing: the hip settles, the chest and head sway slightly, arms hang a little forward. */
const IDLE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    translate: [
      { t: 0, v: [0, 0], ease: 'inOut' },
      { t: 1.2, v: [0, 1], ease: 'inOut' },
      { t: 2.4, v: [0, 0] },
    ],
  },
  chest: {
    rotate: [
      { t: 0, v: 0, ease: 'inOut' },
      { t: 1.2, v: -1.5, ease: 'inOut' },
      { t: 2.4, v: 0 },
    ],
  },
  head: {
    rotate: [
      { t: 0, v: 0, ease: 'inOut' },
      { t: 1.2, v: 2, ease: 'inOut' },
      { t: 2.4, v: 0 },
    ],
  },
  'upperArm.L': {
    rotate: [
      { t: 0, v: -4, ease: 'inOut' },
      { t: 1.2, v: -6, ease: 'inOut' },
      { t: 2.4, v: -4 },
    ],
  },
  'foreArm.L': { rotate: [{ t: 0, v: -8 }] },
  'upperArm.R': {
    rotate: [
      { t: 0, v: 4, ease: 'inOut' },
      { t: 1.2, v: 6, ease: 'inOut' },
      { t: 2.4, v: 4 },
    ],
  },
  'foreArm.R': { rotate: [{ t: 0, v: -8 }] },
};

function bothViews(base: Omit<AnimationClip, 'view'>): Record<RigView, AnimationClip> {
  return { front: { ...base, view: 'front' }, back: { ...base, view: 'back' } };
}

export const CLIPS = {
  idle: bothViews({ name: 'idle', duration: 2.4, loop: true, tracks: IDLE_TRACKS }),
  walk: bothViews({
    name: 'walk',
    duration: 0.8,
    loop: true,
    tracks: WALK_TRACKS,
    events: [{ t: 0, name: 'footstep' }, { t: 0.4, name: 'footstep' }],
  }),
} satisfies Record<string, Record<RigView, AnimationClip>>;

export type ClipId = keyof typeof CLIPS;

/** Walk clip is authored for this pace; playback rate scales with the actor's real pace. */
export const WALK_AUTHORED_MS_PER_CELL = 500;
