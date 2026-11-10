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

/** The near arm comes forward with the forearm up, holds a thumbs-up, and the head nods. */
const THUMBS_UP_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, 1.3, 1.6], [0, -35, -35, 0]) },
  'foreArm.L': { rotate: keys([0, 0.3, 1.3, 1.6], [0, -95, -95, 0]) },
  head: { rotate: keys([0, 0.4, 0.6, 0.8, 1.6], [0, 6, 0, 6, 0]) },
};

/** Arms out with palms up, head tilted, a little bounce at the top. */
const SHRUG_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, 1.1, 1.4], [0, -20, -20, 0]) },
  'upperArm.R': { rotate: keys([0, 0.3, 1.1, 1.4], [0, -20, -20, 0]) },
  'foreArm.L': { rotate: keys([0, 0.3, 1.1, 1.4], [0, -75, -75, 0]) },
  'foreArm.R': { rotate: keys([0, 0.3, 1.1, 1.4], [0, -75, -75, 0]) },
  head: { rotate: keys([0, 0.3, 1.1, 1.4], [0, -8, -8, 0]) },
  hip: { translate: [0, 0.3, 0.5, 1.1, 1.4].map((t, i) => ({ t, v: [0, i === 1 ? -1 : 0] as [number, number], ease: 'inOut' as const })) },
};

/** The near hand comes up over the face; head and chest drop and shake slowly. */
const FACEPALM_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.35, 1.5, 1.8], [0, -55, -55, 0]) },
  'foreArm.L': { rotate: keys([0, 0.35, 1.5, 1.8], [0, -120, -120, 0]) },
  head: { rotate: keys([0, 0.35, 0.7, 0.95, 1.2, 1.5, 1.8], [0, 14, 10, 14, 10, 14, 0]) },
  chest: { rotate: keys([0, 0.35, 1.5, 1.8], [0, 5, 5, 0]) },
};

/** Both arms shoot up and pump while the body bounces. */
const CHEER_BEATS = [0, 0.3, 0.55, 0.8, 1.05, 1.3, 1.8];
const CHEER_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys(CHEER_BEATS, [0, -165, -145, -170, -145, -165, 0]) },
  'upperArm.R': { rotate: keys(CHEER_BEATS, [0, -165, -145, -170, -145, -165, 0]) },
  'foreArm.L': { rotate: keys(CHEER_BEATS, [0, -10, -25, -10, -25, -10, 0]) },
  'foreArm.R': { rotate: keys(CHEER_BEATS, [0, -10, -25, -10, -25, -10, 0]) },
  head: { rotate: keys([0, 0.3, 1.3, 1.8], [0, -8, -8, 0]) },
  hip: { translate: CHEER_BEATS.map((t, i) => ({ t, v: [0, i > 0 && i < 6 && i % 2 ? -2 : 0] as [number, number], ease: 'inOut' as const })) },
};

/** A slow bow from the waist, holding at the bottom. */
const BOW_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  spine: { rotate: keys([0, 0.5, 1.2, 1.7], [0, 18, 18, 0]) },
  chest: { rotate: keys([0, 0.5, 1.2, 1.7], [0, 22, 22, 0]) },
  head: { rotate: keys([0, 0.5, 1.2, 1.7], [0, 10, 10, 0]) },
  'upperArm.L': { rotate: keys([0, 0.5, 1.2, 1.7], [0, -10, -10, 0]) },
  'upperArm.R': { rotate: keys([0, 0.5, 1.2, 1.7], [0, -10, -10, 0]) },
};

/** Both hands to the eyes, sobbing: chest and head bob. */
const CRY_BEATS = [0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6];
const CRY_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.35, 1.7, 2], [0, -55, -55, 0]) },
  'upperArm.R': { rotate: keys([0, 0.35, 1.7, 2], [0, -50, -50, 0]) },
  'foreArm.L': { rotate: keys([0, 0.35, 1.7, 2], [0, -115, -115, 0]) },
  'foreArm.R': { rotate: keys([0, 0.35, 1.7, 2], [0, -115, -115, 0]) },
  head: { rotate: keys([0, ...CRY_BEATS, 2], [0, 10, 6, 10, 6, 10, 6, 10, 0]) },
  chest: { rotate: keys([0, ...CRY_BEATS, 2], [0, 4, 2, 4, 2, 4, 2, 4, 0]) },
};

/** Crouch, spring up with arms raised and legs tucked, land softly. */
const JUMP_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    translate: [
      { t: 0, v: [0, 0], ease: 'inOut' },
      { t: 0.25, v: [0, 3], ease: 'inOut' },
      { t: 0.5, v: [0, -12], ease: 'inOut' },
      { t: 0.75, v: [0, 3], ease: 'inOut' },
      { t: 1.1, v: [0, 0] },
    ],
  },
  'thigh.L': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, -35, -20, -35, 0]) },
  'thigh.R': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, -35, -20, -35, 0]) },
  'shin.L': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, 55, 40, 55, 0]) },
  'shin.R': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, 55, 40, 55, 0]) },
  'upperArm.L': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, 25, -160, -20, 0]) },
  'upperArm.R': { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, 25, -160, -20, 0]) },
  chest: { rotate: keys([0, 0.25, 0.5, 0.75, 1.1], [0, 10, -4, 8, 0]) },
};

/** The near arm points straight ahead and holds. */
const POINT_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.25, 1.2, 1.5], [0, -90, -90, 0]) },
  'foreArm.L': { rotate: keys([0, 0.25, 1.2, 1.5], [0, -5, -5, 0]) },
  chest: { rotate: keys([0, 0.25, 1.2, 1.5], [0, 3, 3, 0]) },
  head: { rotate: keys([0, 0.25, 1.2, 1.5], [0, 3, 3, 0]) },
};

/** Double biceps: upper arms forward, fists up, muscles pulsing; leaning back proudly. */
const FLEX_BEATS = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
const FLEX_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, 1.5, 1.8], [0, -80, -80, 0]) },
  'upperArm.R': { rotate: keys([0, 0.3, 1.5, 1.8], [0, -80, -80, 0]) },
  'foreArm.L': { rotate: keys(FLEX_BEATS, [0, -95, -115, -95, -115, -95, 0]) },
  'foreArm.R': { rotate: keys(FLEX_BEATS, [0, -95, -115, -95, -115, -95, 0]) },
  chest: { rotate: keys([0, 0.3, 1.5, 1.8], [0, -5, -5, 0]) },
  head: { rotate: keys([0, 0.3, 1.5, 1.8], [0, -4, -4, 0]) },
};

/** The near hand goes to the lips, then sweeps out towards whoever's watching. */
const BLOW_KISS_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.35, 0.8, 1.15, 1.6], [0, -45, -45, -110, 0]) },
  'foreArm.L': { rotate: keys([0, 0.35, 0.8, 1.15, 1.6], [0, -125, -125, -10, 0]) },
  head: { rotate: keys([0, 0.35, 0.8, 1.15, 1.6], [0, 6, 6, -4, 0]) },
  chest: { rotate: keys([0, 0.8, 1.15, 1.6], [0, 0, 4, 0]) },
};

/**
 * Four gliding steps backwards: one leg slides back flat while the other bends up onto its
 * toe, swapping every 0.4 s as the body glides 24 px back at a steady pace. A toe-stand
 * with the near arm thrown up, then two quick steps forward back onto the spot.
 */
const MOONWALK_TIMES = [0, 0.2, 0.6, 1, 1.4, 1.8, 2.05, 2.3, 2.6, 2.9];
const MOONWALK_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: {
    translate: [
      { t: 0, v: [0, 0], ease: 'inOut' },
      { t: 0.2, v: [0, 0] },
      { t: 1.8, v: [-24, 0], ease: 'inOut' },
      { t: 2.05, v: [-25, -3], ease: 'inOut' },
      { t: 2.3, v: [-25, -3], ease: 'inOut' },
      { t: 2.6, v: [-12, 1.5], ease: 'inOut' },
      { t: 2.9, v: [0, 0] },
    ],
  },
  'thigh.L': { rotate: keys(MOONWALK_TIMES, [0, -15, 8, -15, 8, -15, 0, 0, -25, 0]) },
  'shin.L': { rotate: keys(MOONWALK_TIMES, [0, 35, 0, 35, 0, 35, 0, 0, 30, 0]) },
  'foot.L': { rotate: keys(MOONWALK_TIMES, [0, 40, 0, 40, 0, 40, 35, 35, 10, 0]) },
  'thigh.R': { rotate: keys(MOONWALK_TIMES, [0, 8, -15, 8, -15, 8, 0, 0, 15, 0]) },
  'shin.R': { rotate: keys(MOONWALK_TIMES, [0, 0, 35, 0, 35, 0, 0, 0, 5, 0]) },
  'foot.R': { rotate: keys(MOONWALK_TIMES, [0, 0, 40, 0, 40, 0, 35, 35, 0, 0]) },
  chest: { rotate: keys([0, 0.2, 1.8, 2.05, 2.3, 2.9], [0, 4, 4, -4, -4, 0]) },
  head: { rotate: keys([0, 0.2, 1.8, 2.05, 2.3, 2.9], [0, 3, 3, -8, -8, 0]) },
  'upperArm.L': { rotate: keys(MOONWALK_TIMES, [0, 10, -10, 10, -10, 10, -160, -160, 15, 0]) },
  'foreArm.L': { rotate: keys(MOONWALK_TIMES, [0, -30, -30, -30, -30, -30, -10, -10, -10, 0]) },
  'upperArm.R': { rotate: keys(MOONWALK_TIMES, [0, -10, 10, -10, 10, -10, 15, 15, -15, 0]) },
  'foreArm.R': { rotate: keys(MOONWALK_TIMES, [0, -30, -30, -30, -30, -30, -40, -40, -10, 0]) },
};

/**
 * Two-person and thrown emotes. Each mutual emote has a clip per role, played at the same
 * time by two avatars MUTUAL_EMOTE_GAP cells apart and facing each other, so "forward"
 * (+x, negative arm angles) is towards the partner. Same length per pair.
 */
const hop = (times: number[], ys: number[], xs?: number[]) =>
  times.map((t, i) => ({ t, v: [xs?.[i] ?? 0, ys[i]] as [number, number], ease: 'inOut' as const }));

/** Giver: winds the near hand up high, hops in and swings it onto the partner's at 0.55 s. */
const HIGH_FIVE_GIVE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, 0.5, 0.58, 0.85, 1.4], [0, -165, -150, -120, -120, 0]) },
  'foreArm.L': { rotate: keys([0, 0.3, 0.5, 0.58, 0.85, 1.4], [0, -20, -10, 0, -30, 0]) },
  'upperArm.R': { rotate: keys([0, 0.55, 1.4], [0, 15, 0]) },
  chest: { rotate: keys([0, 0.3, 0.55, 0.85, 1.4], [0, -5, 6, 2, 0]) },
  head: { rotate: keys([0, 0.3, 0.55, 1.4], [0, -6, 4, 0]) },
  hip: { translate: hop([0, 0.35, 0.5, 0.62, 0.8, 1.4], [0, 1.5, -3, 0, 0, 0], [0, 0, 2, 2, 0, 0]) },
};

/** Taker: holds a hand up early and waits, the slap knocks it back, then shakes the sting off. */
const HIGH_FIVE_TAKE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.25, 0.5, 0.6, 0.75, 1.4], [0, -150, -150, -170, -150, 0]) },
  'foreArm.L': { rotate: keys([0, 0.25, 0.5, 0.6, 0.75, 0.85, 0.95, 1.05, 1.4], [0, -15, -15, 25, -10, 20, -10, 15, 0]) },
  chest: { rotate: keys([0, 0.25, 0.6, 0.8, 1.4], [0, -3, -7, -2, 0]) },
  head: { rotate: keys([0, 0.6, 0.8, 1.4], [0, -8, 0, 0]) },
};

/** Both sway together while hugging. */
const HUG_SWAY = { rotate: keys([0, 0.4, 0.8, 1.2, 1.6, 2.2], [0, 4, -2, 4, 0, 0]) };

/** Giver: steps in with arms wide around the partner, rocks side to side, steps back. */
const HUG_GIVE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: { translate: hop([0, 0.4, 1.7, 2.2], [0, 0, 0, 0], [0, 7, 7, 0]) },
  spine: HUG_SWAY,
  chest: { rotate: keys([0, 0.4, 1.7, 2.2], [0, 8, 8, 0]) },
  head: { rotate: keys([0, 0.4, 1.7, 2.2], [0, 10, 10, 0]) },
  'upperArm.L': { rotate: keys([0, 0.4, 1.7, 2.2], [0, -80, -80, 0]) },
  'upperArm.R': { rotate: keys([0, 0.4, 1.7, 2.2], [0, -80, -80, 0]) },
  'foreArm.L': { rotate: keys([0, 0.4, 1.7, 2.2], [0, -60, -60, 0]) },
  'foreArm.R': { rotate: keys([0, 0.4, 1.7, 2.2], [0, -60, -60, 0]) },
};

/** Taker: leans in a little, head on the giver's shoulder, arms around lower down. */
const HUG_TAKE_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  hip: { translate: hop([0, 0.45, 1.7, 2.2], [0, 0, 0, 0], [0, 3, 3, 0]) },
  spine: HUG_SWAY,
  chest: { rotate: keys([0, 0.45, 1.7, 2.2], [0, 6, 6, 0]) },
  head: { rotate: keys([0, 0.45, 1.7, 2.2], [0, 14, 14, 0]) },
  'upperArm.L': { rotate: keys([0, 0.45, 1.7, 2.2], [0, -70, -70, 0]) },
  'upperArm.R': { rotate: keys([0, 0.45, 1.7, 2.2], [0, -70, -70, 0]) },
  'foreArm.L': { rotate: keys([0, 0.45, 1.7, 2.2], [0, -70, -70, 0]) },
  'foreArm.R': { rotate: keys([0, 0.45, 1.7, 2.2], [0, -70, -70, 0]) },
};

/** Overarm throw with the near hand: wind back, step in, release at THROW_RELEASE_S, follow through. */
export const THROW_RELEASE_S = 0.42;
const THROW_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  'upperArm.L': { rotate: keys([0, 0.3, THROW_RELEASE_S, 0.55, 1], [0, 70, -150, -70, 0]) },
  'foreArm.L': { rotate: keys([0, 0.3, THROW_RELEASE_S, 0.55, 1], [0, -90, -20, -10, 0]) },
  'upperArm.R': { rotate: keys([0, 0.3, 0.45, 1], [0, -40, 20, 0]) },
  chest: { rotate: keys([0, 0.3, 0.45, 0.6, 1], [0, -8, 10, 6, 0]) },
  head: { rotate: keys([0, 0.3, 0.45, 1], [0, -4, 4, 0]) },
  'thigh.L': { rotate: keys([0, 0.3, 0.45, 1], [0, 0, -20, 0]) },
  'shin.L': { rotate: keys([0, 0.45, 1], [0, 15, 0]) },
};

/** Hit in the face: recoils back, hands up to wipe it off, head shaking. */
const HIT_REACT_TRACKS: Partial<Record<BoneName, BoneTrack>> = {
  chest: { rotate: keys([0, 0.08, 0.3, 0.8, 1.1], [0, -14, -6, -6, 0]) },
  head: { rotate: keys([0, 0.08, 0.3, 0.5, 0.7, 1.1], [0, -18, 6, -6, 6, 0]) },
  hip: { translate: hop([0, 0.1, 0.4, 1.1], [0, 0, 0, 0], [0, -4, -2, 0]) },
  'upperArm.L': { rotate: keys([0, 0.15, 0.85, 1.1], [0, -50, -50, 0]) },
  'upperArm.R': { rotate: keys([0, 0.15, 0.85, 1.1], [0, -50, -50, 0]) },
  'foreArm.L': { rotate: keys([0, 0.15, 0.85, 1.1], [0, -120, -120, 0]) },
  'foreArm.R': { rotate: keys([0, 0.15, 0.85, 1.1], [0, -120, -120, 0]) },
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
  thumbsUp: bothViews({ name: 'thumbsUp', duration: 1.6, loop: false, tracks: THUMBS_UP_TRACKS }),
  shrug: bothViews({ name: 'shrug', duration: 1.4, loop: false, tracks: SHRUG_TRACKS }),
  facepalm: bothViews({ name: 'facepalm', duration: 1.8, loop: false, tracks: FACEPALM_TRACKS }),
  cheer: bothViews({ name: 'cheer', duration: 1.8, loop: false, tracks: CHEER_TRACKS }),
  bow: bothViews({ name: 'bow', duration: 1.7, loop: false, tracks: BOW_TRACKS }),
  cry: bothViews({ name: 'cry', duration: 2, loop: false, tracks: CRY_TRACKS }),
  jump: bothViews({ name: 'jump', duration: 1.1, loop: false, tracks: JUMP_TRACKS }),
  point: bothViews({ name: 'point', duration: 1.5, loop: false, tracks: POINT_TRACKS }),
  flex: bothViews({ name: 'flex', duration: 1.8, loop: false, tracks: FLEX_TRACKS }),
  blowKiss: bothViews({ name: 'blowKiss', duration: 1.6, loop: false, tracks: BLOW_KISS_TRACKS }),
  moonwalk: bothViews({ name: 'moonwalk', duration: 2.9, loop: false, tracks: MOONWALK_TRACKS }),
  highFiveGive: bothViews({ name: 'highFiveGive', duration: 1.4, loop: false, tracks: HIGH_FIVE_GIVE_TRACKS }),
  highFiveTake: bothViews({ name: 'highFiveTake', duration: 1.4, loop: false, tracks: HIGH_FIVE_TAKE_TRACKS }),
  hugGive: bothViews({ name: 'hugGive', duration: 2.2, loop: false, tracks: HUG_GIVE_TRACKS }),
  hugTake: bothViews({ name: 'hugTake', duration: 2.2, loop: false, tracks: HUG_TAKE_TRACKS }),
  throw: bothViews({ name: 'throw', duration: 1, loop: false, tracks: THROW_TRACKS }),
  hitReact: bothViews({ name: 'hitReact', duration: 1.1, loop: false, tracks: HIT_REACT_TRACKS }),
} satisfies Record<string, Record<RigView, AnimationClip>>;

export type ClipId = keyof typeof CLIPS;

/**
 * Clips an `emote` action can name. Solo ones match an EMOTE entry in the backend's
 * animation catalog; the rest are the parts of mutual and interactive emotes, which the
 * session plays (see session/emotes.ts).
 */
export const EMOTE_CLIPS = [
  'wave', 'clap', 'laugh', 'dance',
  'thumbsUp', 'shrug', 'facepalm', 'cheer', 'bow', 'cry', 'jump', 'point', 'flex', 'blowKiss',
  'moonwalk',
  'highFiveGive', 'highFiveTake', 'hugGive', 'hugTake', 'throw', 'hitReact',
] as const satisfies readonly ClipId[];

export function isEmoteClip(name: string): name is (typeof EMOTE_CLIPS)[number] {
  return (EMOTE_CLIPS as readonly string[]).includes(name);
}

/**
 * Emotes that only move the upper body (and at most bob the hip), so they can play over
 * the sit pose: a seated avatar waves without getting up. See drawAvatar's overlay.
 */
export const SEATED_EMOTE_CLIPS = [
  'wave', 'clap', 'laugh', 'thumbsUp', 'shrug', 'facepalm', 'cheer', 'bow', 'cry', 'point', 'flex', 'blowKiss',
] as const satisfies readonly (typeof EMOTE_CLIPS)[number][];

export function isSeatedEmoteClip(name: string): name is (typeof SEATED_EMOTE_CLIPS)[number] {
  return (SEATED_EMOTE_CLIPS as readonly string[]).includes(name);
}

/** Walk clip is authored for this pace; playback rate scales with the actor's real pace. */
export const WALK_AUTHORED_MS_PER_CELL = 500;
