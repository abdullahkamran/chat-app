import { Skia, type SkCanvas, type SkColor } from '@shopify/react-native-skia';

import type { PropId } from '../../core/contract';

/** A throw as the frame loop needs it: seconds, not ms. */
export interface EffectDraw {
  id: string;
  prop: PropId;
  fromId: string;
  toId: string;
  flightS: number;
  splatS: number;
}

export interface PropColors {
  tomato: SkColor;
  tomatoSplat: SkColor;
  leaf: SkColor;
  snow: SkColor;
  snowShade: SkColor;
  highlight: SkColor;
}

/** Rig heights above the feet: roughly the throwing hand at release, and the face. */
const HAND_Y = -60;
const HAND_X = 8;
const FACE_Y = -70;
const ARC_BASE = 22;
const ARC_PER_PX = 0.18;
const POP_IN_S = 0.08;
const FADE_FROM = 0.6;
const BLOBS = 6;

function easeOut(q: number): number {
  'worklet';
  return 1 - (1 - q) * (1 - q);
}

function drawProp(canvas: SkCanvas, prop: PropId, x: number, y: number, c: PropColors): void {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (prop === 'tomato') {
    paint.setColor(c.tomato);
    canvas.drawCircle(x, y, 5.5, paint);
    paint.setColor(c.leaf);
    canvas.drawOval(Skia.XYWHRect(x - 3, y - 7, 6, 3), paint);
  } else {
    paint.setColor(c.snowShade);
    canvas.drawCircle(x + 0.8, y + 0.8, 5, paint);
    paint.setColor(c.snow);
    canvas.drawCircle(x - 0.4, y - 0.4, 4.4, paint);
  }
  paint.setColor(c.highlight);
  paint.setAlphaf(0.6);
  canvas.drawCircle(x - 1.8, y - 1.8, 1.5, paint);
}

/**
 * What a prop leaves on the face it hits, `q` from 0 to 1 of its time there: a tomato
 * splats and drips down, a snowball bursts into a puff. Fades out over the last part.
 */
function drawSplat(canvas: SkCanvas, prop: PropId, x: number, y: number, age: number, q: number, c: PropColors): void {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(prop === 'tomato' ? c.tomatoSplat : c.snow);
  paint.setAlphaf(q < FADE_FROM ? 1 : Math.max(0, 1 - (q - FADE_FROM) / (1 - FADE_FROM)));
  const pop = Math.min(1, age / POP_IN_S);
  if (prop === 'tomato') {
    canvas.drawCircle(x, y, 7 * pop, paint);
    for (let i = 0; i < BLOBS; i++) {
      const a = (i / BLOBS) * Math.PI * 2 + 0.3;
      const d = (8 + (i % 2) * 2.5) * pop;
      canvas.drawCircle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 2 + (i % 3) * 0.6, paint);
    }
    // Three drips slide down the face.
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 4;
      canvas.drawCircle(x + dx, y + 6 + (14 + i * 5) * q * q, 1.6, paint);
    }
  } else {
    const spread = easeOut(q);
    canvas.drawCircle(x, y, 6 * pop * (1 - 0.4 * spread), paint);
    for (let i = 0; i < BLOBS + 2; i++) {
      const a = (i / (BLOBS + 2)) * Math.PI * 2;
      const d = (5 + 12 * spread) * pop;
      canvas.drawCircle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 2.4 * (1 - 0.5 * spread), paint);
    }
  }
}

/**
 * Draw every throw: the prop arcing from the thrower's hand to the target's face, then its
 * splat on the face. Both ends follow the actors as they move. A throw whose thrower or
 * target isn't drawn is skipped.
 */
export function drawEffects(
  canvas: SkCanvas,
  effects: EffectDraw[],
  ages: Record<string, number>,
  feetById: Record<string, { x: number; y: number }>,
  colors: PropColors,
): void {
  'worklet';
  for (const e of effects) {
    const from = feetById[e.fromId];
    const to = feetById[e.toId];
    const age = ages[e.id] ?? 0;
    if (!to) continue;
    const fx = to.x;
    const fy = to.y + FACE_Y;
    if (age < e.flightS) {
      if (!from) continue;
      const dir = to.x >= from.x ? 1 : -1;
      const sx = from.x + dir * HAND_X;
      const sy = from.y + HAND_Y;
      const p = age / e.flightS;
      const arc = (ARC_BASE + Math.hypot(fx - sx, fy - sy) * ARC_PER_PX) * 4 * p * (1 - p);
      drawProp(canvas, e.prop, sx + (fx - sx) * p, sy + (fy - sy) * p - arc, colors);
    } else if (age < e.flightS + e.splatS) {
      const t = age - e.flightS;
      drawSplat(canvas, e.prop, fx, fy, t, t / e.splatS, colors);
    }
  }
}
