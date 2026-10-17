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
  | { kind: 'path'; d: string };

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
  }
}

export const HEAD_R = 9;
export const HEAD_CY = -8;

/** The bare body, one skin piece per bone; clothing is drawn a little wider over it. */
export function bodyShapes(view: RigView): Partial<Record<BoneName, Shape>> {
  void view;
  return {
    hip: capsule(13, -3, 4),
    spine: capsule(13, -11, 2),
    chest: capsule(15, -16, 1),
    neck: capsule(5, -5, 1),
    head: disc(0, HEAD_CY, HEAD_R),
    'upperArm.L': capsule(5, -2, 13),
    'foreArm.L': capsule(4.5, -1, 12),
    'hand.L': disc(0, 2, 3),
    'upperArm.R': capsule(5, -2, 13),
    'foreArm.R': capsule(4.5, -1, 12),
    'hand.R': disc(0, 2, 3),
    'thigh.L': capsule(7, -3, 18),
    'shin.L': capsule(6, -1, 16),
    'foot.L': { kind: 'oval', x: -3, y: -2, w: 10, h: 5 },
    'thigh.R': capsule(7, -3, 18),
    'shin.R': capsule(6, -1, 16),
    'foot.R': { kind: 'oval', x: -3, y: -2, w: 10, h: 5 },
  };
}
