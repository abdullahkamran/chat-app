import type { AnimationClip, BoneTrack, BoneName, ClipKey, RigView } from '@chat-app/shared-types';

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

/**
 * Seated, breathing slowly. Thighs swing forward 80 degrees (knees end 3 px below the
 * hip) and shins hang straight down, so dropping the hip 14 px puts the feet back on
 * the anchor's floor line, 21 px ahead of it, with the hip right above the anchor. The
 * seat lifts the anchor to the cushion (ItemSeat.offset.z); the hands rest on the thighs.
 */
const SIT_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    translate: [
      { t: 0, v: [0, 14], ease: 'inOut' },
      { t: 1.4, v: [0, 14.5], ease: 'inOut' },
      { t: 2.8, v: [0, 14] },
    ],
  },
  chest: {
    rotate: [
      { t: 0, v: -3, ease: 'inOut' },
      { t: 1.4, v: -4.5, ease: 'inOut' },
      { t: 2.8, v: -3 },
    ],
  },
  head: {
    rotate: [
      { t: 0, v: 2, ease: 'inOut' },
      { t: 1.4, v: 3.5, ease: 'inOut' },
      { t: 2.8, v: 2 },
    ],
  },
  'thigh.L': { rotate: [{ t: 0, v: -80 }] },
  'shin.L': { rotate: [{ t: 0, v: 80 }] },
  'thigh.R': { rotate: [{ t: 0, v: -80 }] },
  'shin.R': { rotate: [{ t: 0, v: 80 }] },
  'upperArm.L': { rotate: [{ t: 0, v: -30 }] },
  'foreArm.L': { rotate: [{ t: 0, v: -45 }] },
  'upperArm.R': { rotate: [{ t: 0, v: -30 }] },
  'foreArm.R': { rotate: [{ t: 0, v: -45 }] },
};

/**
 * Emotes. One-shot clips named after their Animation catalog entry; they start and end
 * near the bind pose so the crossfades in and out stay short. Raising an arm forward
 * and up is negative (-90 points it ahead, -180 straight up); leaning the chest back is
 * negative too. The near arm in the front view is `.L`.
 */
function keys(times: number[], values: number[]): ClipKey<number>[] {
  return times.map((t, i) => ({ t, v: values[i], ease: 'inOut' }));
}

/** The near arm goes up and the hand waves side to side three times. */
const WAVE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, 1.5, 1.8], [0, -160, -160, 0]) },
  'foreArm.L': { rotate: keys([0, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.8], [0, 0, 35, -15, 35, -15, 35, 0, 0]) },
  chest: { rotate: keys([0, 0.3, 1.5, 1.8], [0, -2, -2, 0]) },
  head: { rotate: keys([0, 0.3, 1.5, 1.8], [0, 5, 5, 0]) },
};

/** Both hands come up in front and clap five times. */
const CLAP_BEATS = [0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35];
const CLAP_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.25, 1.35, 1.6], [0, -50, -50, 0]) },
  'upperArm.R': { rotate: keys([0, 0.25, 1.35, 1.6], [0, -50, -50, 0]) },
  'foreArm.L': { rotate: keys([0, ...CLAP_BEATS, 1.6], [0, -60, -85, -60, -85, -60, -85, -60, -85, 0]) },
  'foreArm.R': { rotate: keys([0, ...CLAP_BEATS, 1.6], [0, -85, -60, -85, -60, -85, -60, -85, -60, 0]) },
  head: { rotate: keys([0, 0.3, 1.35, 1.6], [0, 3, 3, 0]) },
};

/** Throws the head back, shakes with laughter holding the belly, then doubles forward. */
const LAUGH_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  chest: { rotate: keys([0, 0.25, 0.4, 0.55, 0.7, 0.85, 1.1, 1.4, 1.6], [0, -8, -5, -8, -5, -8, 6, 6, 0]) },
  head: { rotate: keys([0, 0.25, 0.85, 1.1, 1.4, 1.6], [0, -10, -10, 4, 4, 0]) },
  hip: { translate: [0, 0.3, 0.45, 0.6, 0.75, 0.9, 1.6].map((t, i) => ({ t, v: [0, i % 2 ? 1.5 : 0] as [number, number], ease: 'inOut' as const })) },
  'upperArm.L': { rotate: keys([0, 0.25, 1.4, 1.6], [0, -25, -25, 0]) },
  'foreArm.L': { rotate: keys([0, 0.25, 1.4, 1.6], [0, -80, -80, 0]) },
  'upperArm.R': { rotate: keys([0, 0.25, 1.4, 1.6], [0, -25, -25, 0]) },
  'foreArm.R': { rotate: keys([0, 0.25, 1.4, 1.6], [0, -80, -80, 0]) },
};

/** Eight beats of 0.4 s: hips sway and bob, arms pump up in turn, knees dip on each beat. */
const DANCE_BEATS = [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2];
const alternate = (a: number, b: number) => DANCE_BEATS.map((_, i) => (i === 0 || i === 8 ? 0 : i % 2 ? a : b));
const DANCE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    translate: DANCE_BEATS.map((t, i) => ({
      t,
      v: (i === 0 || i === 8 ? [0, 0] : [i % 2 ? 3 : -3, 2.5]) as [number, number],
      ease: 'inOut' as const,
    })),
  },
  chest: { rotate: keys(DANCE_BEATS, alternate(8, -8)) },
  head: { rotate: keys(DANCE_BEATS, alternate(-6, 6)) },
  'upperArm.L': { rotate: keys(DANCE_BEATS, alternate(-150, -30)) },
  'upperArm.R': { rotate: keys(DANCE_BEATS, alternate(-30, -150)) },
  'foreArm.L': { rotate: keys(DANCE_BEATS, alternate(-30, -60)) },
  'foreArm.R': { rotate: keys(DANCE_BEATS, alternate(-60, -30)) },
  'thigh.L': { rotate: keys(DANCE_BEATS, alternate(-15, 0)) },
  'shin.L': { rotate: keys(DANCE_BEATS, alternate(25, 0)) },
  'thigh.R': { rotate: keys(DANCE_BEATS, alternate(0, -15)) },
  'shin.R': { rotate: keys(DANCE_BEATS, alternate(0, 25)) },
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
  sit: bothViews({ name: 'sit', duration: 2.8, loop: true, tracks: SIT_TRACKS }),
  wave: bothViews({ name: 'wave', duration: 1.8, loop: false, tracks: WAVE_TRACKS }),
  clap: bothViews({ name: 'clap', duration: 1.6, loop: false, tracks: CLAP_TRACKS }),
  laugh: bothViews({ name: 'laugh', duration: 1.6, loop: false, tracks: LAUGH_TRACKS }),
  dance: bothViews({ name: 'dance', duration: 3.2, loop: false, tracks: DANCE_TRACKS }),
} satisfies Record<string, Record<RigView, AnimationClip>>;

export type ClipId = keyof typeof CLIPS;

/** Clips an `emote` action can name; each matches an EMOTE entry in the backend's animation catalog. */
export const EMOTE_CLIPS = ['wave', 'clap', 'laugh', 'dance'] as const satisfies readonly ClipId[];

export function isEmoteClip(name: string): name is (typeof EMOTE_CLIPS)[number] {
  return (EMOTE_CLIPS as readonly string[]).includes(name);
}

/** Walk clip is authored for this pace; playback rate scales with the actor's real pace. */
export const WALK_AUTHORED_MS_PER_CELL = 500;
