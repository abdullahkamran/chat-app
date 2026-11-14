import { PaintStyle, Skia, type SkCanvas, type SkImage, type SkRect } from '@shopify/react-native-skia';

import { artPalette } from '@/constants/theme';
import type { PetKind, RigView } from '@chat-app/shared-types';
import type { PetClip } from '../../../core/pets';
import type { CompiledClip } from '../skeleton/sampler';
import { ALL_PET_CLIPS, FALLBACK, PET_CLIP_DEFS, type PetClipDef, type PetTrack } from './petClips';
import { PET_RIGS, boneIndexOf, rigArrays, type PetPiece, type PetRig, type PetRigArrays, type PetShape } from './petRigs';

/**
 * Pet programmer art and compiled clips.
 *
 * Each kind's pieces are drawn once into one small atlas (normal and mirrored copies side by
 * side, like the avatars' programmer art), so a pet is one drawAtlas per frame. The
 * designer's art will arrive as the same kind of atlas, made by the art pipeline instead.
 */

/** Atlas pixels per content pixel: sharp at 1.5x zoom on a 2x screen. */
const ART_SCALE = 3;
const PAD = 2;
const OUTLINE = 1;

/** What the UI thread needs to draw one view, back to front. */
export interface PetDrawList {
  bone: number[];
  src: SkRect[];
  srcMirror: SkRect[];
  pivotX: number[];
  pivotXMirror: number[];
  pivotY: number[];
}

export interface PetArt {
  image: SkImage;
  scale: number;
  views: Record<RigView, PetDrawList>;
}

// ── Clips ─────────────────────────────────────────────────────────────────────

const EASE_CODE = { linear: 0, stepped: 1, inOut: 2 } as const;

function channel(keys: PetTrack['rotate'] | PetTrack['translate'], pick: (v: number | [number, number]) => number) {
  if (!keys?.length) return null;
  return { t: keys.map(k => k.t), v: keys.map(k => pick(k.v)), e: keys.map(k => EASE_CODE[k.ease ?? 'linear']) };
}

/** Same format as the avatars' compiled clips, so sampler.ts samples and blends them. */
function compile(def: PetClipDef, index: Record<string, number>, count: number): CompiledClip {
  const rotate: CompiledClip['rotate'] = Array(count).fill(null);
  const translateX: CompiledClip['translateX'] = Array(count).fill(null);
  const translateY: CompiledClip['translateY'] = Array(count).fill(null);
  for (const [bone, track] of Object.entries(def.tracks)) {
    const i = index[bone];
    if (i === undefined) throw new Error(`Pet clip keys an unknown bone: ${bone}`);
    rotate[i] = channel(track.rotate, v => v as number);
    translateX[i] = channel(track.translate, v => (v as [number, number])[0]);
    translateY[i] = channel(track.translate, v => (v as [number, number])[1]);
  }
  return { duration: def.duration, loop: def.loop, rotate, translateX, translateY };
}

/** A kind's clip for `clip`, following FALLBACK to one it has. */
function defFor(kind: PetKind, clip: PetClip): PetClipDef {
  let c: PetClip = clip;
  for (let i = 0; i < ALL_PET_CLIPS.length; i++) {
    const def = PET_CLIP_DEFS[kind][c];
    if (def) return def;
    c = FALLBACK[c];
  }
  return PET_CLIP_DEFS[kind].idle!;
}

/** Everything about a kind the frame loop reads, apart from its art. */
export interface PetKindRuntime {
  rig: PetRigArrays;
  clips: Record<PetClip, CompiledClip>;
  walkPace: number;
  runPace: number;
  shadowW: number;
  shadowH: number;
}

function runtimeFor(kind: PetKind): PetKindRuntime {
  const rig: PetRig = PET_RIGS[kind];
  const index = boneIndexOf(rig);
  const clips = Object.fromEntries(
    ALL_PET_CLIPS.map(c => [c, compile(defFor(kind, c), index, rig.bones.length)]),
  ) as Record<PetClip, CompiledClip>;
  return { rig: rigArrays(rig), clips, walkPace: rig.walkPace, runPace: rig.runPace, shadowW: rig.shadow.w, shadowH: rig.shadow.h };
}

export const PET_RUNTIME: Record<PetKind, PetKindRuntime> = {
  cat: runtimeFor('cat'),
  dog: runtimeFor('dog'),
  bird: runtimeFor('bird'),
};

// ── Art ───────────────────────────────────────────────────────────────────────

function shapeBounds(s: PetShape): [number, number, number, number] {
  switch (s.kind) {
    case 'ellipse': return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
    case 'dot': return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
    case 'bar': {
      const r = s.w / 2;
      return [Math.min(s.x0, s.x1) - r, Math.min(s.y0, s.y1) - r, Math.max(s.x0, s.x1) + r, Math.max(s.y0, s.y1) + r];
    }
    case 'poly': {
      const xs = s.points.filter((_, i) => i % 2 === 0);
      const ys = s.points.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
}

function pieceBounds(piece: PetPiece): [number, number, number, number] {
  const all = piece.shapes.map(shapeBounds);
  return [
    Math.min(...all.map(b => b[0])) - OUTLINE,
    Math.min(...all.map(b => b[1])) - OUTLINE,
    Math.max(...all.map(b => b[2])) + OUTLINE,
    Math.max(...all.map(b => b[3])) + OUTLINE,
  ];
}

function drawShape(canvas: SkCanvas, s: PetShape) {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(s.color));
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(OUTLINE);
  stroke.setColor(Skia.Color(artPalette.pets.ink));
  switch (s.kind) {
    case 'ellipse': {
      const rect = Skia.XYWHRect(s.cx - s.rx, s.cy - s.ry, 2 * s.rx, 2 * s.ry);
      canvas.drawOval(rect, fill);
      canvas.drawOval(rect, stroke);
      return;
    }
    case 'dot':
      canvas.drawCircle(s.cx, s.cy, s.r, fill);
      return;
    case 'bar': {
      // A rounded rect along the bar, drawn upright and turned into place.
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const angle = (Math.atan2(s.y1 - s.y0, s.x1 - s.x0) * 180) / Math.PI - 90;
      canvas.save();
      canvas.translate(s.x0, s.y0);
      canvas.rotate(angle, 0, 0);
      const rrect = Skia.RRectXY(Skia.XYWHRect(-s.w / 2, -s.w / 2, s.w, len + s.w), s.w / 2, s.w / 2);
      canvas.drawRRect(rrect, fill);
      canvas.drawRRect(rrect, stroke);
      canvas.restore();
      return;
    }
    case 'poly': {
      const b = Skia.PathBuilder.Make().moveTo(s.points[0], s.points[1]);
      for (let i = 2; i < s.points.length; i += 2) b.lineTo(s.points[i], s.points[i + 1]);
      const path = b.close().build();
      canvas.drawPath(path, fill);
      canvas.drawPath(path, stroke);
      return;
    }
  }
}

function buildArt(kind: PetKind): PetArt {
  const rig = PET_RIGS[kind];
  const index = boneIndexOf(rig);
  const entries = (['front', 'back'] as RigView[]).flatMap(view => rig.pieces[view].map(piece => ({ view, piece })));
  const cells = entries.map(({ piece }) => {
    const [minX, minY, maxX, maxY] = pieceBounds(piece);
    return { w: Math.ceil((maxX - minX) * ART_SCALE) + 2 * PAD, h: Math.ceil((maxY - minY) * ART_SCALE) + 2 * PAD };
  });
  const half = Math.max(...cells.map(c => c.w));
  const height = cells.reduce((sum, c) => sum + c.h, 0);
  const surface = Skia.Surface.Make(2 * half, height);
  if (!surface) throw new Error('Could not create the pet atlas surface');
  const canvas = surface.getCanvas();

  const empty = (): PetDrawList => ({ bone: [], src: [], srcMirror: [], pivotX: [], pivotXMirror: [], pivotY: [] });
  const views: Record<RigView, PetDrawList> = { front: empty(), back: empty() };
  let top = 0;
  entries.forEach(({ view, piece }, i) => {
    const { w, h } = cells[i];
    const [minX, minY, maxX] = pieceBounds(piece);
    const pivotX = PAD - minX * ART_SCALE;
    const pivotXMirror = PAD + maxX * ART_SCALE;
    const pivotY = PAD - minY * ART_SCALE;
    const draw = () => piece.shapes.forEach(s => drawShape(canvas, s));

    canvas.save();
    canvas.translate(pivotX, top + pivotY);
    canvas.scale(ART_SCALE, ART_SCALE);
    draw();
    canvas.restore();

    canvas.save();
    canvas.translate(half + pivotXMirror, top + pivotY);
    canvas.scale(-ART_SCALE, ART_SCALE);
    draw();
    canvas.restore();

    const list = views[view];
    list.bone.push(index[piece.bone]);
    list.src.push(Skia.XYWHRect(0, top, w, h));
    list.srcMirror.push(Skia.XYWHRect(half, top, w, h));
    list.pivotX.push(pivotX);
    list.pivotXMirror.push(pivotXMirror);
    list.pivotY.push(pivotY);
    top += h;
  });

  const snapshot = surface.makeImageSnapshot();
  // A CPU-backed copy can be drawn from the UI thread's canvas.
  return { image: snapshot.makeNonTextureImage() ?? snapshot, scale: ART_SCALE, views };
}

let arts: Record<PetKind, PetArt> | null = null;

/** Built on first use and kept for the app's lifetime. */
export function getPetArts(): Record<PetKind, PetArt> {
  arts ??= { cat: buildArt('cat'), dog: buildArt('dog'), bird: buildArt('bird') };
  return arts;
}
