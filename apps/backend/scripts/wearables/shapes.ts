import type { BoneName, RigView } from '@chat-app/shared-types';

/**
 * Simple vector shapes in bone-local content pixels (bone origin at 0, 0; the bone
 * hangs along +y or points along -y). Used for the template's reference body and the
 * generated starter art. Views face screen right.
 */
export type Shape =
  | { kind: 'capsule'; w: number; y0: number; y1: number }
  | { kind: 'disc'; cx: number; cy: number; r: number }
  | { kind: 'oval'; x: number; y: number; w: number; h: number }
  | { kind: 'path'; d: string }
  /** Ready-made SVG markup, for pieces that need masks or clip paths. */
  | { kind: 'raw'; svg: string };

export function capsule(w: number, y0: number, y1: number): Shape {
  return { kind: 'capsule', w, y0, y1 };
}

export function disc(cx: number, cy: number, r: number): Shape {
  return { kind: 'disc', cx, cy, r };
}

export function shapeSvg(shape: Shape, attrs: string): string {
  switch (shape.kind) {
    case 'capsule': {
      const r = shape.w / 2;
      return `<rect x="${-r}" y="${shape.y0}" width="${shape.w}" height="${shape.y1 - shape.y0}" rx="${r}" ry="${r}" ${attrs}/>`;
    }
    case 'disc':
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${attrs}/>`;
    case 'oval':
      return `<ellipse cx="${shape.x + shape.w / 2}" cy="${shape.y + shape.h / 2}" rx="${shape.w / 2}" ry="${shape.h / 2}" ${attrs}/>`;
    case 'path':
      return `<path d="${shape.d}" ${attrs}/>`;
    case 'raw':
      return shape.svg;
  }
}

/**
 * The skull in head art units: head art is drawn at this size and scaled up by HEAD_SCALE
 * about the head bone's origin when it's written, so the head is large for the body.
 */
export const HEAD_R = 9;
export const HEAD_CY = -8;
export const HEAD_SCALE = 1.4;

/** The bare body, one skin piece per bone; clothing is drawn a little wider over it. */
export function bodyShapes(view: RigView): Partial<Record<BoneName, Shape>> {
  void view;
  return {
    hip: capsule(13, -3, 3.5),
    spine: capsule(12.6, -9, 1.5),
    chest: capsule(14, -11, 1),
    neck: capsule(5, -7, 1),
    head: disc(0, HEAD_CY * HEAD_SCALE, HEAD_R * HEAD_SCALE),
    'upperArm.L': capsule(4.8, -2.4, 10.5),
    'foreArm.L': capsule(4.2, -1.5, 10),
    'hand.L': disc(0, 2, 2.8),
    'upperArm.R': capsule(4.8, -2.4, 10.5),
    'foreArm.R': capsule(4.2, -1.5, 10),
    'hand.R': disc(0, 2, 2.8),
    'thigh.L': capsule(6.6, -3.3, 17),
    'shin.L': capsule(5.4, -2, 15.5),
    'foot.L': { kind: 'oval', x: -2.5, y: -2, w: 9, h: 4.5 },
    'thigh.R': capsule(6.6, -3.3, 17),
    'shin.R': capsule(5.4, -2, 15.5),
    'foot.R': { kind: 'oval', x: -2.5, y: -2, w: 9, h: 4.5 },
  };
}
