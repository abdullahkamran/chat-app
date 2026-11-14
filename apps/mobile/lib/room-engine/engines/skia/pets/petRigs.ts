import { artPalette } from '@/constants/theme';
import type { PetKind } from '@chat-app/shared-types';

/**
 * Pet rigs: one small skeleton per kind, like the avatars' humanoid-v1 but much simpler.
 *
 * Bones are in content pixels at zoom 1 (y down), drawn side on facing screen right; the
 * west facings mirror. The root is the ground under the middle of the body. Bind rotations
 * are all 0, so a child's offset is in its parent's frame and a clip's angle is the bone's
 * whole local rotation (clockwise degrees).
 *
 * Cats and dogs share the quadruped bone names, so their clips can share keys. Legs come in
 * near and far pairs: the far pair draws behind the body, the near pair in front.
 */

export interface PetBone {
  name: string;
  parent?: string;
  x: number;
  y: number;
}

/** A programmer-art shape on a bone, in the bone's frame. */
export type PetShape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string }
  /** A rounded bar from (x0, y0) to (x1, y1), `w` thick. */
  | { kind: 'bar'; x0: number; y0: number; x1: number; y1: number; w: number; color: string }
  | { kind: 'poly'; points: number[]; color: string }
  /** Unoutlined dots and marks (eyes, nose). */
  | { kind: 'dot'; cx: number; cy: number; r: number; color: string };

export interface PetPiece {
  bone: string;
  shapes: PetShape[];
}

export interface PetRig {
  bones: PetBone[];
  /** Back to front. `back` is drawn for the north-facing pair: the face is hidden. */
  pieces: { front: PetPiece[]; back: PetPiece[] };
  /** Shadow under the pet, in content pixels. */
  shadow: { w: number; h: number };
  /** Cells per second the walk and run clips were keyed for; playback scales to the real pace. */
  walkPace: number;
  runPace: number;
}

const { eye: EYE, cat: CAT_COLORS, dog: DOG_COLORS, bird: BIRD_COLORS } = artPalette.pets;

// ── Quadrupeds ────────────────────────────────────────────────────────────────

interface QuadLook {
  fur: string;
  farFur: string;
  /** Body centre above the ground, and half its length and height. */
  bodyY: number;
  bodyRx: number;
  bodyRy: number;
  legLen: number;
  legW: number;
  headR: number;
  /** Extra head shapes (ears, snout), drawn over the head circle in the front view. */
  face: PetShape[];
  /** Ears that also show from behind. */
  backEars: PetShape[];
  tail: { len: number; tipLen: number; w: number; tipColor?: string };
}

function quadruped(look: QuadLook): Omit<PetRig, 'walkPace' | 'runPace'> {
  const { bodyY, bodyRx, bodyRy, legLen, legW, headR } = look;
  const hipX = bodyRx * 0.62;
  const legY = bodyRy * 0.45;
  const bones: PetBone[] = [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -bodyY },
    { name: 'neck', parent: 'body', x: bodyRx * 0.75, y: -bodyRy * 0.55 },
    { name: 'head', parent: 'neck', x: headR * 0.25, y: -headR * 0.85 },
    { name: 'tail', parent: 'body', x: -bodyRx * 0.9, y: -bodyRy * 0.3 },
    { name: 'tailTip', parent: 'tail', x: -look.tail.len * 0.35, y: -look.tail.len * 0.94 },
    { name: 'legFarBack', parent: 'body', x: -hipX + 2, y: legY },
    { name: 'legFarFront', parent: 'body', x: hipX + 2, y: legY },
    { name: 'legNearBack', parent: 'body', x: -hipX, y: legY + 1 },
    { name: 'legNearFront', parent: 'body', x: hipX, y: legY + 1 },
  ];
  const leg = (color: string, extra = 0): PetShape => ({ kind: 'bar', x0: 0, y0: 0, x1: 0, y1: legLen + extra, w: legW, color });
  const tail: PetShape = { kind: 'bar', x0: 0, y0: 0, x1: -look.tail.len * 0.35, y1: -look.tail.len * 0.94, w: look.tail.w, color: look.fur };
  const tailTip: PetShape = { kind: 'bar', x0: 0, y0: 0, x1: look.tail.tipLen * 0.3, y1: -look.tail.tipLen, w: look.tail.w, color: look.tail.tipColor ?? look.fur };
  const head: PetShape = { kind: 'ellipse', cx: 0, cy: 0, rx: headR, ry: headR * 0.92, color: look.fur };
  const body: PetShape = { kind: 'ellipse', cx: 0, cy: 0, rx: bodyRx, ry: bodyRy, color: look.fur };
  const far: PetPiece[] = [
    { bone: 'legFarBack', shapes: [leg(look.farFur, -1)] },
    { bone: 'legFarFront', shapes: [leg(look.farFur, -1)] },
    { bone: 'tail', shapes: [tail] },
    { bone: 'tailTip', shapes: [tailTip] },
    { bone: 'body', shapes: [body] },
    { bone: 'legNearBack', shapes: [leg(look.fur)] },
    { bone: 'legNearFront', shapes: [leg(look.fur)] },
  ];
  return {
    bones,
    pieces: {
      front: [...far, { bone: 'head', shapes: [...look.backEars, head, ...look.face] }],
      back: [...far, { bone: 'head', shapes: [...look.backEars, head] }],
    },
    shadow: { w: bodyRx * 2.4, h: bodyRx * 0.7 },
  };
}

const CAT_FUR = CAT_COLORS.fur;
const CAT_HEAD_R = 6.5;

const CAT: PetRig = {
  ...quadruped({
    fur: CAT_FUR,
    farFur: CAT_COLORS.farFur,
    bodyY: 12,
    bodyRx: 12,
    bodyRy: 6.5,
    legLen: 10,
    legW: 3.6,
    headR: CAT_HEAD_R,
    backEars: [
      { kind: 'poly', points: [-5, -3, -4.5, -11, 0, -5.5], color: CAT_FUR },
      { kind: 'poly', points: [1.5, -5.5, 5, -11, 6, -3], color: CAT_FUR },
    ],
    face: [
      { kind: 'dot', cx: 1.8, cy: -1, r: 1, color: EYE },
      { kind: 'dot', cx: 4.8, cy: -1, r: 1, color: EYE },
      { kind: 'dot', cx: 5.6, cy: 1.6, r: 0.8, color: CAT_COLORS.nose },
    ],
    tail: { len: 10, tipLen: 7, w: 3, tipColor: CAT_COLORS.farFur },
  }),
  walkPace: 1.4,
  runPace: 3,
};

const DOG_FUR = DOG_COLORS.fur;
const DOG_HEAD_R = 7.5;

const DOG: PetRig = {
  ...quadruped({
    fur: DOG_FUR,
    farFur: DOG_COLORS.farFur,
    bodyY: 15,
    bodyRx: 15,
    bodyRy: 8,
    legLen: 12,
    legW: 4.6,
    headR: DOG_HEAD_R,
    backEars: [{ kind: 'ellipse', cx: -4, cy: 1, rx: 3, ry: 6, color: DOG_COLORS.ear }],
    face: [
      { kind: 'ellipse', cx: 6.5, cy: 2.5, rx: 4.5, ry: 3.2, color: DOG_COLORS.muzzle },
      { kind: 'dot', cx: 10.4, cy: 1.4, r: 1.5, color: EYE },
      { kind: 'dot', cx: 3, cy: -2.5, r: 1.1, color: EYE },
    ],
    tail: { len: 7, tipLen: 5, w: 3.2 },
  }),
  walkPace: 1.8,
  runPace: 3.5,
};

// ── Bird ──────────────────────────────────────────────────────────────────────

const BIRD_BLUE = BIRD_COLORS.body;
const BIRD_WING = BIRD_COLORS.wing;
const BIRD_LEG = BIRD_COLORS.leg;

const BIRD: PetRig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -9 },
    { name: 'head', parent: 'body', x: 5, y: -6 },
    { name: 'tail', parent: 'body', x: -6.5, y: 0.5 },
    { name: 'wingFar', parent: 'body', x: 0, y: -3 },
    { name: 'wingNear', parent: 'body', x: -1, y: -2 },
    { name: 'legFar', parent: 'body', x: 1.5, y: 4 },
    { name: 'legNear', parent: 'body', x: -1, y: 4 },
  ],
  pieces: (() => {
    const body: PetPiece[] = [
      { bone: 'legFar', shapes: [{ kind: 'bar', x0: 0, y0: 0, x1: 0, y1: 5, w: 1.4, color: BIRD_LEG }] },
      { bone: 'wingFar', shapes: [{ kind: 'poly', points: [2, 0, -10, -2, -6, 3], color: BIRD_WING }] },
      { bone: 'tail', shapes: [{ kind: 'poly', points: [0, -2, -9, 1, -7, 4, 0, 2], color: BIRD_WING }] },
      { bone: 'legNear', shapes: [{ kind: 'bar', x0: 0, y0: 0, x1: 0, y1: 5, w: 1.4, color: BIRD_LEG }] },
      {
        bone: 'body',
        shapes: [
          { kind: 'ellipse', cx: 0, cy: 0, rx: 8, ry: 6, color: BIRD_BLUE },
          { kind: 'dot', cx: 2.5, cy: 2, r: 3.6, color: BIRD_COLORS.belly },
        ],
      },
      { bone: 'wingNear', shapes: [{ kind: 'poly', points: [3, 0, -9, -1, -5, 4], color: BIRD_WING }] },
    ];
    const head: PetShape = { kind: 'ellipse', cx: 0, cy: 0, rx: 4.5, ry: 4.5, color: BIRD_BLUE };
    const beak: PetShape = { kind: 'poly', points: [3.6, -1.6, 8, 0, 3.6, 1.4], color: BIRD_COLORS.beak };
    return {
      front: [...body, { bone: 'head', shapes: [head, beak, { kind: 'dot', cx: 2, cy: -1, r: 0.9, color: EYE }] }],
      back: [...body, { bone: 'head', shapes: [beak, head] }],
    };
  })(),
  shadow: { w: 16, h: 5 },
  walkPace: 1.5,
  runPace: 1.5,
};

export const PET_RIGS: Record<PetKind, PetRig> = { cat: CAT, dog: DOG, bird: BIRD };

/** Flat arrays for the UI-thread solver: parents precede children. */
export interface PetRigArrays {
  parent: number[];
  x: number[];
  y: number[];
}

export function boneIndexOf(rig: PetRig): Record<string, number> {
  return Object.fromEntries(rig.bones.map((b, i) => [b.name, i]));
}

export function rigArrays(rig: PetRig): PetRigArrays {
  const index = boneIndexOf(rig);
  return {
    parent: rig.bones.map(b => (b.parent ? index[b.parent] : -1)),
    x: rig.bones.map(b => b.x),
    y: rig.bones.map(b => b.y),
  };
}
