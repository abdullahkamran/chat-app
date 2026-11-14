import { BlendMode, FilterMode, MipmapMode, Skia, type SkCanvas } from '@shopify/react-native-skia';

import type { Facing, PetKind } from '@chat-app/shared-types';
import { facingFromDelta, facingToView } from '../../../core/facing';
import type { PetClip, PetState } from '../../../core/pets';
import { blendPose, samplePose, type Pose } from '../skeleton/sampler';
import type { PetArt, PetKindRuntime } from './petArt';
import { PET_RUNTIME } from './petArt';

/**
 * Pets on the UI thread: where each one is and what it plays at a moment, read straight off
 * its timeline (core/pets.ts), then drawn with its rig. Nothing is carried between frames:
 * clip time is time since the segment started, so every client shows the same pose.
 */

const CROSSFADE_MS = 200;
const ATLAS_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

/** A timeline segment, flattened for the frame loop. Times are device milliseconds. */
export interface PetSegmentDraw {
  start: number;
  end: number;
  clip: PetClip;
  xs: number[];
  ys: number[];
  /** Distance along the path at each point. */
  cum: number[];
  total: number;
  arc: number;
  facing: Facing;
  /** Clip seconds per real second: walks play at the pace they cover ground. */
  rate: number;
}

export interface PetDraw {
  id: string;
  kind: PetKind;
  segments: PetSegmentDraw[];
}

/** Turns the session's pets into what the frame loop reads. */
export function petDraws(pets: readonly PetState[]): PetDraw[] {
  return pets.map(p => {
    const rt = PET_RUNTIME[p.kind];
    return {
      id: p.id,
      kind: p.kind,
      segments: p.segments.map(s => {
        const cum = [0];
        for (let i = 1; i < s.path.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y));
        }
        const total = cum[cum.length - 1];
        const seconds = Math.max(0.001, (s.end - s.start) / 1000);
        const pace = total / seconds;
        const authored = s.clip === 'run' ? rt.runPace : rt.walkPace;
        const paced = s.clip === 'walk' || s.clip === 'run' || s.clip === 'hop';
        return {
          start: s.start,
          end: s.end,
          clip: s.clip,
          xs: s.path.map(p => p.x),
          ys: s.path.map(p => p.y),
          cum,
          total,
          arc: s.arc,
          facing: s.facing,
          rate: paced && total > 0 ? pace / authored : 1,
        };
      }),
    };
  });
}

export interface PetFrame {
  gx: number;
  gy: number;
  /** Height above the floor in grid z units (a flying bird). */
  z: number;
  facing: Facing;
  clip: PetClip;
  time: number;
  prevClip: PetClip | '';
  prevTime: number;
  fade: number;
}

/** Where a pet is and what it plays at `now` (device ms). */
export function petFrame(p: PetDraw, now: number): PetFrame | null {
  'worklet';
  const segs = p.segments;
  if (segs.length === 0) return null;
  let i = 0;
  while (i < segs.length - 1 && now >= segs[i].end) i++;
  const s = segs[i];
  const t = Math.min(Math.max(now, s.start), s.end);
  const u = s.end > s.start ? (t - s.start) / (s.end - s.start) : 1;

  let gx = s.xs[0];
  let gy = s.ys[0];
  let facing = s.facing;
  if (s.total > 0) {
    const d = u * s.total;
    let k = 0;
    while (k < s.cum.length - 2 && d > s.cum[k + 1]) k++;
    const legLen = s.cum[k + 1] - s.cum[k];
    const f = legLen > 0 ? (d - s.cum[k]) / legLen : 1;
    gx = s.xs[k] + (s.xs[k + 1] - s.xs[k]) * f;
    gy = s.ys[k] + (s.ys[k + 1] - s.ys[k]) * f;
    facing = facingFromDelta(s.xs[k + 1] - s.xs[k], s.ys[k + 1] - s.ys[k]);
  }
  const z = s.arc > 0 ? s.arc * Math.sin(Math.PI * u) : 0;

  const time = ((t - s.start) / 1000) * s.rate;
  let prevClip: PetClip | '' = '';
  let prevTime = 0;
  let fade = 1;
  if (i > 0 && t - s.start < CROSSFADE_MS && segs[i - 1].clip !== s.clip) {
    const q = segs[i - 1];
    prevClip = q.clip;
    prevTime = ((t - q.start) / 1000) * q.rate;
    fade = (t - s.start) / CROSSFADE_MS;
  }
  return { gx, gy, z, facing, clip: s.clip, time, prevClip, prevTime, fade };
}

/** One pass over the bone tree; bind rotations are all 0 (see petRigs.ts). */
function solvePet(pose: Pose, rt: PetKindRuntime) {
  'worklet';
  const { parent, x: bx, y: by } = rt.rig;
  const x: number[] = [];
  const y: number[] = [];
  const angle: number[] = [];
  for (let i = 0; i < parent.length; i++) {
    const lx = bx[i] + pose.tx[i];
    const ly = by[i] + pose.ty[i];
    const local = (pose.rotate[i] * Math.PI) / 180;
    const p = parent[i];
    if (p < 0) {
      x.push(lx);
      y.push(ly);
      angle.push(local);
    } else {
      const c = Math.cos(angle[p]);
      const sn = Math.sin(angle[p]);
      x.push(x[p] + c * lx - sn * ly);
      y.push(y[p] + sn * lx + c * ly);
      angle.push(angle[p] + local);
    }
  }
  return { x, y, angle };
}

/** Draws a pet with its root at (x, y): sample, blend, solve, one drawAtlas. */
export function drawPet(canvas: SkCanvas, art: PetArt, rt: PetKindRuntime, f: PetFrame, x: number, y: number) {
  'worklet';
  const { view, mirror } = facingToView(f.facing);
  let pose = samplePose(rt.clips[f.clip], f.time);
  if (f.prevClip !== '') pose = blendPose(samplePose(rt.clips[f.prevClip], f.prevTime), pose, f.fade);
  const bones = solvePet(pose, rt);

  const list = art.views[view];
  const xforms = [];
  for (let i = 0; i < list.bone.length; i++) {
    const b = list.bone[i];
    const bx = mirror ? -bones.x[b] : bones.x[b];
    const angle = mirror ? -bones.angle[b] : bones.angle[b];
    const px = mirror ? list.pivotXMirror[i] : list.pivotX[i];
    xforms.push(Skia.RSXformFromRadians(1 / art.scale, angle, x + bx, y + bones.y[b], px, list.pivotY[i]));
  }
  canvas.drawAtlas(art.image, mirror ? list.srcMirror : list.src, xforms, Skia.Paint(), BlendMode.SrcOver, undefined, ATLAS_SAMPLING);
}
