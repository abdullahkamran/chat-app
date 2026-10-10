import type { AnimationClip, BoneName, ClipEase, ClipKey, RigView } from '@chat-app/shared-types';

import { CLIPS, type ClipId } from './clips';
import { BONE_COUNT, BONE_INDEX, RIG_ARRAYS } from './humanoidV1';

/**
 * Clip sampling and bone solving, as UI-thread worklets.
 *
 * Clips are compiled once (on the JS thread) into flat per-bone key arrays indexed
 * like the rig's bones, which worklets can read cheaply every frame.
 */

const EASE_CODE: Record<ClipEase, number> = { linear: 0, stepped: 1, inOut: 2 };

/** One animated channel: key times, values and the easing towards the next key. */
interface Channel {
  t: number[];
  v: number[];
  e: number[];
}

export interface CompiledClip {
  duration: number;
  loop: boolean;
  /** Per bone index; null when the clip doesn't animate that channel. */
  rotate: (Channel | null)[];
  translateX: (Channel | null)[];
  translateY: (Channel | null)[];
}

/** Bone-local deltas from the bind pose: degrees and pixels. */
export interface Pose {
  rotate: number[];
  tx: number[];
  ty: number[];
}

/** Bone origins and absolute angles (radians) in avatar space: feet at (0, 0), facing screen right. */
export interface WorldBones {
  x: number[];
  y: number[];
  angle: number[];
}

function channel<V extends number | [number, number]>(
  keys: ClipKey<V>[] | undefined,
  pick: (v: V) => number,
): Channel | null {
  if (!keys?.length) return null;
  return {
    t: keys.map(k => k.t),
    v: keys.map(k => pick(k.v)),
    e: keys.map(k => EASE_CODE[k.ease ?? 'linear']),
  };
}

function compileClip(clip: AnimationClip): CompiledClip {
  const rotate: (Channel | null)[] = Array(BONE_COUNT).fill(null);
  const translateX: (Channel | null)[] = Array(BONE_COUNT).fill(null);
  const translateY: (Channel | null)[] = Array(BONE_COUNT).fill(null);
  for (const [bone, track] of Object.entries(clip.tracks)) {
    if (!track) continue;
    const i = BONE_INDEX[bone as BoneName];
    rotate[i] = channel(track.rotate, v => v);
    translateX[i] = channel(track.translate, v => v[0]);
    translateY[i] = channel(track.translate, v => v[1]);
  }
  return { duration: clip.duration, loop: clip.loop, rotate, translateX, translateY };
}

export type CompiledClips = Record<ClipId, Record<RigView, CompiledClip>>;

export const COMPILED_CLIPS: CompiledClips = Object.fromEntries(
  Object.entries(CLIPS).map(([id, views]) => [
    id,
    { front: compileClip(views.front), back: compileClip(views.back) },
  ]),
) as CompiledClips;

function sampleChannel(ch: Channel | null, time: number): number {
  'worklet';
  if (ch === null) return 0;
  const { t, v, e } = ch;
  const last = t.length - 1;
  if (time <= t[0]) return v[0];
  if (time >= t[last]) return v[last];
  let i = 0;
  while (i < last - 1 && time >= t[i + 1]) i++;
  if (e[i] === 1) return v[i];
  let u = (time - t[i]) / (t[i + 1] - t[i]);
  if (e[i] === 2) u = u * u * (3 - 2 * u);
  return v[i] + (v[i + 1] - v[i]) * u;
}

/** Wrap or clamp a playhead to the clip's length. */
export function clipTime(clip: CompiledClip, time: number): number {
  'worklet';
  if (!clip.loop) return Math.min(time, clip.duration);
  const t = time % clip.duration;
  return t < 0 ? t + clip.duration : t;
}

export function samplePose(clip: CompiledClip, time: number): Pose {
  'worklet';
  const t = clipTime(clip, time);
  const rotate: number[] = [];
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i < clip.rotate.length; i++) {
    rotate.push(sampleChannel(clip.rotate[i], t));
    tx.push(sampleChannel(clip.translateX[i], t));
    ty.push(sampleChannel(clip.translateY[i], t));
  }
  return { rotate, tx, ty };
}

/** Linear blend from `from` to `to` by `w` (0 = from, 1 = to), used for crossfades. */
export function blendPose(from: Pose, to: Pose, w: number): Pose {
  'worklet';
  const mix = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * w);
  return { rotate: mix(from.rotate, to.rotate), tx: mix(from.tx, to.tx), ty: mix(from.ty, to.ty) };
}

/** One forward pass over the bone tree (parents precede children). */
export function solveWorld(pose: Pose, view: RigView): WorldBones {
  'worklet';
  const { parent, bindX, bindY, bindRotation } = RIG_ARRAYS;
  const bx = bindX[view];
  const x: number[] = [];
  const y: number[] = [];
  const angle: number[] = [];
  for (let i = 0; i < parent.length; i++) {
    const lx = bx[i] + pose.tx[i];
    const ly = bindY[i] + pose.ty[i];
    const local = ((bindRotation[i] + pose.rotate[i]) * Math.PI) / 180;
    const p = parent[i];
    if (p < 0) {
      x.push(lx);
      y.push(ly);
      angle.push(local);
    } else {
      const c = Math.cos(angle[p]);
      const s = Math.sin(angle[p]);
      x.push(x[p] + c * lx - s * ly);
      y.push(y[p] + s * lx + c * ly);
      angle.push(angle[p] + local);
    }
  }
  return { x, y, angle };
}
