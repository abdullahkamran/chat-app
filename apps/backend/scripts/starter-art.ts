/**
 * Generates placeholder wearable art for today's avatar catalog, until real art is
 * drawn on the rig template in Figma.
 *
 *   pnpm --filter @chat-app/backend art:starter && pnpm --filter @chat-app/backend art:pack
 *
 * Writes art/wearables/<id>/ folders in exactly the format an artist would export:
 * one full-frame SVG per piece, named <bone>.<layer>[.<band>].svg. Re-running overwrites
 * these folders only.
 *
 * The art is moving to a cel-shaded style (outlines, a shadow tone on the left; helpers in
 * wearables/cel.ts). The body, faces, default features, long hair, t-shirt, jeans and
 * sneakers are done; the rest still use the flat placeholder shapes.
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WEARABLE_ART_SCALE, type BoneName, type DrawBand, type RigView, type SlotLayer } from '@chat-app/shared-types';

import { ART_DIR, FRAME_PX_H, FRAME_PX_W, frameOrigins } from './wearables/frame';
import {
  GREY, LINE_W, SKIN, cel, circleD, crescent, ellipseD, leftOf, limbD, limbShade, strokeSvg, uid,
  type CelInner, type CelPaint,
} from './wearables/cel';
import { HEAD_CY, HEAD_R, capsule, disc, shapeSvg, type Shape } from './wearables/shapes';

const S = WEARABLE_ART_SCALE;
const OUTLINE = 0.6;

/** Art colours, taken from the legacy catalog SVGs. Art data, not app UI. */
const C = {
  tintBase: '#ffffff',
  tintLine: '#8a8a8a',
  feature: '#2b2b2b',
  eyeWhite: '#ffffff',
  shade: 'rgba(0,0,0,0.22)',
  denim: '#8c949b',
  denimLine: '#515252',
  cargo: '#98885f',
  cargoLine: '#77684a',
  hairDark: '#3e3f4b',
  hairDarkLine: '#2a2b33',
  hairRed: '#8e403b',
  hairRedLine: '#5e2a27',
  hairBlond: '#ddbe94',
  hairBlondLine: '#a68a63',
  gold: '#f2c230',
  heartRed: '#e0475b',
  catEye: '#c9e265',
  freckle: '#b0714f',
  tongue: '#e86f86',
  iris: '#6b4a2f',
  mouth: '#6e2a2a',
  blush: '#ff8a8a',
  stitch: '#d9a441',
  /** Shading on features over any skin tone. */
  skinShadow: 'rgba(110,45,30,0.22)',
  skinLine: 'rgba(90,40,30,0.75)',
};

interface Piece {
  bone: BoneName;
  layer: SlotLayer;
  views: RigView[];
  /** Omitted for the body band. */
  band?: DrawBand;
  /** Shapes drawn in order, each with its SVG paint attributes. */
  shapes: Array<[Shape, string]>;
}

interface Wearable {
  tintable?: boolean;
  pieces: Piece[];
}

const BOTH: RigView[] = ['front', 'back'];
const FRONT: RigView[] = ['front'];

const paint = (fill: string, line: string) => `fill="${fill}" stroke="${line}" stroke-width="${OUTLINE}"`;
const ink = (color: string, width = 0.8) => `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"`;

function sided<T extends string>(name: T): [`${T}.L`, `${T}.R`] {
  return [`${name}.L`, `${name}.R`];
}

// ── Cel-shaded art ──────────────────────────────────────────────────────────
// Outlined parts with a shadow tone on the left (light from screen right). Tintable
// parts are drawn in greys (GREY, SKIN in cel.ts) so the runtime tint keeps the shading.

/** Torso outlines, `g` wider all round for clothing over the body. */
const TORSO = {
  chest: (g: number) =>
    `M ${-4 - g} ${-16.5 - g} Q ${-8.2 - g} ${-16.5 - g} ${-8.2 - g} -12.5 L ${-6.9 - g} 1.5 ` +
    `Q 0 ${3 + g} ${6.9 + g} 1.5 L ${8.2 + g} -12.5 Q ${8.2 + g} ${-16.5 - g} ${4 + g} ${-16.5 - g} Z`,
  spine: (g: number, hem = 2) =>
    `M ${-6.7 - g} -11 L ${6.7 + g} -11 L ${6.9 + g} ${hem} Q 0 ${hem + 1.6 + g} ${-6.9 - g} ${hem} Z`,
  hip: (g: number) =>
    `M ${-6.9 - g} -3.5 L ${6.9 + g} -3.5 L ${7.1 + g} 3 Q 0 ${6 + g} ${-7.1 - g} 3 Z`,
};

/** Limb sizes: width at the joint, width at the far end, start and end along the bone. */
type LimbSize = readonly [number, number, number, number];
const LIMB: Record<'upperArm' | 'foreArm' | 'thigh' | 'shin', LimbSize> = {
  upperArm: [5.4, 4.4, -2.5, 13.5],
  foreArm: [4.4, 3.6, -1, 12],
  thigh: [7.6, 6.2, -3, 18.5],
  shin: [6.2, 4.8, -1, 16],
};

function limb(size: LimbSize, paint: CelPaint, inner: CelInner = {}): Shape {
  return cel(limbD(...size), paint, { ...inner, shade: [limbShade(...size), ...(inner.shade ?? [])] });
}

const HAND = 'M -1.9 -0.6 L 1.9 -0.6 Q 2.4 2.5 1.4 4.3 Q 0 5.3 -1.4 4.3 Q -2.4 2.5 -1.9 -0.6 Z';
const THUMB = 'M 1.5 0.3 Q 3.5 0.6 3.1 2.6 Q 2.3 3.1 1.6 2.3 Z';
const FOOT = 'M -3 -2.2 Q -3.6 2.6 -2.4 3.2 L 6.2 3.2 Q 8 2.8 7.2 0.8 Q 5.2 -1.4 1.8 -2.2 Z';

function body(): Wearable {
  const parts: Partial<Record<BoneName, Shape[]>> = {
    hip: [cel(TORSO.hip(0), SKIN, { shade: [leftOf(-4.5)] })],
    spine: [cel(TORSO.spine(0), SKIN, { shade: [leftOf(-4.2)] })],
    chest: [cel(TORSO.chest(0), SKIN, { shade: [leftOf(-4.8)] })],
    // The chin shades the top of the neck.
    neck: [cel(limbD(5.4, 4.8, 1.5, -5), SKIN, { shade: [leftOf(-0.8), 'M -40 -60 H 40 V -2.2 H -40 Z'] })],
    head: [cel(circleD(0, HEAD_CY, HEAD_R), SKIN, { shade: [crescent(0, HEAD_CY, HEAD_R)] })],
  };
  for (const side of ['L', 'R'] as const) {
    parts[`upperArm.${side}`] = [limb(LIMB.upperArm, SKIN)];
    parts[`foreArm.${side}`] = [limb(LIMB.foreArm, SKIN)];
    parts[`hand.${side}`] = [cel(HAND, SKIN, { shade: [leftOf(-0.6)] }), cel(THUMB, SKIN)];
    parts[`thigh.${side}`] = [limb(LIMB.thigh, SKIN)];
    parts[`shin.${side}`] = [limb(LIMB.shin, SKIN)];
    parts[`foot.${side}`] = [cel(FOOT, SKIN, { shade: [leftOf(-1)] })];
  }
  const pieces = (Object.entries(parts) as [BoneName, Shape[]][]).map(([bone, shapes]): Piece => ({
    bone, layer: 'skin', views: BOTH, shapes: shapes.map(s => [s, '']),
  }));
  return { tintable: true, pieces };
}

/** Features sit right of centre: the front view is turned towards screen right. */
const EYE_Y = HEAD_CY + 1;
const EYES_X = [1.5, 5.5];
/** The far eye (screen left) is foreshortened by the three-quarter turn. */
const EYE_K = [0.8, 1];

/**
 * A face shape, shaded on the left, with an ear towards the back of the head and a
 * blush on the cheeks. From behind, the near ear sits right of centre.
 */
function face(outline: string): Wearable {
  const shade = `M -40 -60 H 40 V 60 H -40 Z ${circleD(2.6, HEAD_CY - 1.4, HEAD_R + 0.3)}`;
  // Out on the cheeks, clear of the nose.
  const blush = (cx: number, rx: number) =>
    `<path d="${ellipseD(cx, HEAD_CY + 3.8, rx, 0.8)}" fill="${C.blush}" fill-opacity="0.35"/>`;
  const ear = (cx: number) => cel(ellipseD(cx, HEAD_CY + 1.4, 1.5, 2.1), SKIN, {
    shade: [leftOf(cx - 0.2)],
    lines: [`M ${cx + 0.5} ${HEAD_CY + 0.4} Q ${cx - 0.6} ${HEAD_CY + 1.2} ${cx + 0.3} ${HEAD_CY + 2.6}`],
  });
  return {
    tintable: true,
    pieces: [
      { bone: 'head', layer: 'face', views: FRONT, shapes: [
        [cel(outline, SKIN, { shade: [shade], raw: blush(7.7, 1) + blush(-0.4, 0.9) }), ''],
        [ear(-4.4), ''],
      ] },
      { bone: 'head', layer: 'face', views: ['back'], shapes: [[cel(outline, SKIN, { shade: [shade] }), ''], [ear(4.4), '']] },
    ],
  };
}

function eyes(style: 'dots' | 'open'): Wearable {
  const parts = EYES_X.map((x, i) => {
    const k = EYE_K[i];
    if (style === 'dots') {
      return `<path d="${ellipseD(x, EYE_Y, 1.05 * k, 1.6)}" fill="${C.feature}"/>` +
        `<circle cx="${x + 0.35 * k}" cy="${EYE_Y - 0.6}" r="0.42" fill="${C.eyeWhite}"/>` +
        `<circle cx="${x - 0.3 * k}" cy="${EYE_Y + 0.7}" r="0.2" fill="${C.eyeWhite}"/>`;
    }
    // A large iris almost filling the eye, outlined only by a heavy upper lid.
    const id = uid('eye');
    const white = ellipseD(x, EYE_Y, 1.3 * k, 1.7);
    return `<defs><clipPath id="${id}"><path d="${white}"/></clipPath></defs>` +
      `<path d="${white}" fill="${C.eyeWhite}"/>` +
      `<g clip-path="url(#${id})">` +
      `<circle cx="${x + 0.3 * k}" cy="${EYE_Y + 0.2}" r="1.15" fill="${C.iris}"/>` +
      `<circle cx="${x + 0.3 * k}" cy="${EYE_Y + 0.2}" r="0.6" fill="${C.feature}"/>` +
      `<circle cx="${x + 0.65 * k}" cy="${EYE_Y - 0.35}" r="0.36" fill="${C.eyeWhite}"/></g>` +
      strokeSvg(`M ${x - 1.4 * k} ${EYE_Y - 0.1} Q ${x} ${EYE_Y - 2.5} ${x + 1.4 * k} ${EYE_Y - 0.3}` +
        (i === 1 ? ` L ${x + 1.9} ${EYE_Y - 0.9}` : ''), C.feature, 0.7);
  });
  return { pieces: [{ bone: 'head', layer: 'eye', views: FRONT, shapes: [[{ kind: 'raw', svg: parts.join('') }, '']] }] };
}

function nose(style: 'normal' | 'round'): Wearable {
  const svg = style === 'normal'
    // A hooked line for the tip and a small cast shadow beneath it.
    ? `<path d="${ellipseD(5.4, HEAD_CY + 5, 0.9, 0.35)}" fill="${C.skinShadow}"/>` +
      strokeSvg(`M 5.5 ${HEAD_CY + 2.4} Q 6.8 ${HEAD_CY + 4} 6.2 ${HEAD_CY + 4.6} Q 5.7 ${HEAD_CY + 4.9} 5.1 ${HEAD_CY + 4.6}`, C.skinLine, 0.5)
    : `<path d="${ellipseD(6.3, HEAD_CY + 4.1, 1, 0.9)}" fill="${C.skinShadow}"/>` +
      strokeSvg(`M 5.3 ${HEAD_CY + 4.5} Q 6.3 ${HEAD_CY + 5.4} 7.3 ${HEAD_CY + 4.5}`, C.skinLine, 0.45) +
      `<circle cx="6.6" cy="${HEAD_CY + 3.6}" r="0.3" fill="${C.eyeWhite}" fill-opacity="0.6"/>`;
  return { pieces: [{ bone: 'head', layer: 'nose', views: FRONT, shapes: [[{ kind: 'raw', svg }, '']] }] };
}

function mouth(mood: 'happy' | 'angry'): Wearable {
  const y = HEAD_CY + 6.5;
  let svg: string;
  if (mood === 'happy') {
    // An open smile: teeth along the top, tongue at the bottom.
    const id = uid('mouth');
    const open = `M 2 ${y - 0.2} Q 4.2 ${y + 0.2} 6.4 ${y - 0.7} Q 6 ${y + 2.2} 4.2 ${y + 2.2} Q 2.3 ${y + 2.1} 2 ${y - 0.2} Z`;
    svg = `<defs><clipPath id="${id}"><path d="${open}"/></clipPath></defs>` +
      `<path d="${open}" fill="${C.mouth}"/>` +
      `<g clip-path="url(#${id})"><path d="M 0 ${y - 2} H 8 V ${y + 0.3} H 0 Z" fill="${C.eyeWhite}"/>` +
      `<path d="${ellipseD(4.5, y + 2.2, 1.3, 0.8)}" fill="${C.tongue}"/></g>` +
      strokeSvg(open, C.feature, 0.45);
  } else {
    svg = strokeSvg(`M 1.6 ${y + 1} Q 4 ${y - 0.9} 6.5 ${y + 0.8}`, C.feature, 0.7) +
      strokeSvg(`M -0.2 ${EYE_Y - 3.5} L 2.9 ${EYE_Y - 2.2} M 4.3 ${EYE_Y - 2.2} L 7.8 ${EYE_Y - 3.6}`, C.feature, 0.8);
  }
  return { pieces: [{ bone: 'head', layer: 'mouth', views: FRONT, shapes: [[{ kind: 'raw', svg }, '']] }] };
}

/** Fixed colours for the legacy-catalog clothes, which aren't tintable. */
const TEE: CelPaint = { base: '#82c55f', shade: '#5f9e45', line: '#3b6a29', light: '#a7dd86' };
const DENIM: CelPaint = { base: '#3f6699', shade: '#2d4d78', line: '#1e324f', light: '#5b83b8' };

/** A crew-neck t-shirt: the collar rib sits on the neck bone so it draws over the neck. */
function celTee(): Wearable {
  const sleeve = [6.6, 6, -3.2, 7.5] as const;
  return {
    pieces: [
      { bone: 'chest', layer: 'tops', views: BOTH, shapes: [[cel(TORSO.chest(0.6), TEE, {
        shade: [leftOf(-4.5)],
        light: ['M 3 -17.6 Q 8.8 -17.6 8.8 -12 Q 6.4 -14.6 3 -15.6 Z'],
        lines: ['M -3.2 -6.5 Q -1.6 -4.2 -3.6 -1.2', 'M 5.6 -10.5 Q 4.6 -8 5.2 -5.5'],
      }), '']] },
      { bone: 'spine', layer: 'tops', views: BOTH, shapes: [[cel(TORSO.spine(0.6, 3.5), TEE, {
        shade: [leftOf(-4.2)],
        lines: ['M -7.3 2 Q 0 3.6 7.3 2'],
      }), '']] },
      { bone: 'neck', layer: 'tops', views: BOTH, shapes: [[cel('M -3 -0.6 Q 0 1.4 3 -0.6 L 3.2 1.6 Q 0 3.6 -3.2 1.6 Z', TEE, { shade: [leftOf(-1.5)] }), '']] },
      ...sided('upperArm').map((bone): Piece => ({ bone, layer: 'tops', views: BOTH, shapes: [[cel(limbD(...sleeve), TEE, {
        shade: [limbShade(...sleeve)],
        light: ['M 1.6 -3 Q 3.4 -2 3.2 2 L 2.2 2 Z'],
        lines: ['M -2.9 5.9 Q 0 6.7 2.9 5.9'],
      }), '']] })),
    ],
  };
}

/** Jeans with gold stitching: a seam down the outside of each leg, a fly and rolled cuffs. */
function celJeans(): Wearable {
  const thigh = [8.4, 7.2, -3, 18.8] as const;
  const shin = [7.2, 6.8, -1.5, 15.6] as const;
  const stitch = (d: string) =>
    `<path d="${d}" fill="none" stroke="${C.stitch}" stroke-width="0.3" stroke-dasharray="0.8 0.6"/>`;
  return {
    pieces: [
      { bone: 'hip', layer: 'bottoms', views: BOTH, shapes: [[cel(TORSO.hip(0.6), DENIM, {
        shade: [leftOf(-4.5)],
        lines: ['M -7.6 -1.3 Q 0 0.1 7.6 -1.3', 'M 2.6 -0.9 Q 2.9 2 2.3 4.6'],
        raw: stitch('M -7.6 -2.4 Q 0 -1 7.6 -2.4') + stitch('M 3.4 -0.6 Q 3.7 2 3.1 4.2'),
      }), '']] },
      ...sided('thigh').map((bone): Piece => ({ bone, layer: 'bottoms', views: BOTH, shapes: [[cel(limbD(...thigh), DENIM, {
        shade: [limbShade(...thigh)],
        light: ['M 1.6 -2 L 3.4 -2 L 2.8 17 L 1.4 17 Z'],
        lines: ['M -2 15.4 Q 0 16.4 2 15.5'],
        raw: stitch('M 3.2 -2 L 2.7 18'),
      }), '']] })),
      ...sided('shin').map((bone): Piece => ({ bone, layer: 'bottoms', views: BOTH, shapes: [[cel(limbD(...shin), DENIM, {
        shade: [limbShade(...shin), 'M -40 13.2 H 40 V 30 H -40 Z'],
        lines: ['M -3.6 13.2 H 3.6'],
        raw: stitch('M 2.9 -1 L 2.7 13'),
      }), '']] })),
    ],
  };
}

const TOP = HEAD_CY - HEAD_R;

function hair(style: 'parted' | 'puffed' | 'spiked', fill: string, line: string): Wearable {
  const r = HEAD_R + 0.6;
  // Front: a cap with a fringe that leaves the face (screen right) clear.
  const caps: Record<typeof style, string> = {
    parted:
      `M ${-r} ${HEAD_CY + 6} A ${r} ${r} 0 0 1 ${r} ${HEAD_CY - 1} ` +
      `Q 3 ${HEAD_CY - 6} 0 ${TOP + 1.5} Q -2 ${HEAD_CY - 4} -4 ${HEAD_CY + 9} Z`,
    puffed:
      `M ${-r - 1} ${HEAD_CY + 1} C ${-r - 2} ${TOP - 5} ${r + 2} ${TOP - 5} ${r + 1} ${HEAD_CY - 1} ` +
      `L ${-2} ${HEAD_CY - 3.5} Z`,
    spiked:
      `M ${-r} ${HEAD_CY} L ${-r + 1} ${TOP - 2} L -4 ${TOP + 1} L -2 ${TOP - 3.5} L 1 ${TOP + 0.5} ` +
      `L 3 ${TOP - 3.5} L 5 ${TOP + 1} L 8 ${TOP - 2} L ${r} ${HEAD_CY - 1} L -2 ${HEAD_CY - 3} Z`,
  };
  // Back: hair covers all but the nape.
  const nape = Math.sqrt(r * r - 25);
  const backs: Record<typeof style, string> = {
    parted: `M ${-nape} ${HEAD_CY + 5} A ${r} ${r} 0 1 1 ${nape} ${HEAD_CY + 5} Z`,
    puffed: `M ${-r - 1} ${HEAD_CY + 4} C ${-r - 2} ${TOP - 5} ${r + 2} ${TOP - 5} ${r + 1} ${HEAD_CY + 4} Z`,
    spiked:
      `M ${-r} ${HEAD_CY + 4} L ${-r + 1} ${TOP - 2} L -4 ${TOP + 1} L -2 ${TOP - 3.5} L 1 ${TOP + 0.5} ` +
      `L 3 ${TOP - 3.5} L 5 ${TOP + 1} L 8 ${TOP - 2} L ${r} ${HEAD_CY + 4} Z`,
  };
  const attrs = paint(fill, line);
  return {
    pieces: [
      { bone: 'head', layer: 'hair', views: FRONT, shapes: [[{ kind: 'path', d: caps[style] }, attrs]] },
      { bone: 'head', layer: 'hair', views: ['back'], shapes: [[{ kind: 'path', d: backs[style] }, attrs]] },
    ],
  };
}

function top(sleeves: 'short' | 'long', fill: string, line: string): Wearable {
  const attrs = paint(fill, line);
  const pieces: Piece[] = [
    { bone: 'chest', layer: 'tops', views: BOTH, shapes: [[capsule(16.5, -16.5, 2), attrs]] },
    { bone: 'spine', layer: 'tops', views: BOTH, shapes: [[capsule(14.5, -11, 4), attrs]] },
  ];
  for (const arm of sided('upperArm')) {
    pieces.push({ bone: arm, layer: 'tops', views: BOTH, shapes: [[capsule(6.5, -2.5, sleeves === 'short' ? 7 : 13.5), attrs]] });
  }
  if (sleeves === 'long') {
    for (const arm of sided('foreArm')) {
      pieces.push({ bone: arm, layer: 'tops', views: BOTH, shapes: [[capsule(5.8, -1.5, 11), attrs]] });
    }
  }
  return { pieces };
}

function trousers(fill: string, line: string, pockets: boolean): Wearable {
  const attrs = paint(fill, line);
  const pieces: Piece[] = [{ bone: 'hip', layer: 'bottoms', views: BOTH, shapes: [[capsule(14, -3.5, 5), attrs]] }];
  for (const leg of sided('thigh')) {
    const shapes: Array<[Shape, string]> = [[capsule(8.2, -3, 18.5), attrs]];
    if (pockets) shapes.push([{ kind: 'path', d: 'M -3 8 h 6 v 5 h -6 Z' }, paint(fill, line)]);
    pieces.push({ bone: leg, layer: 'bottoms', views: BOTH, shapes });
  }
  for (const leg of sided('shin')) {
    pieces.push({ bone: leg, layer: 'bottoms', views: BOTH, shapes: [[capsule(7.2, -1.5, 15), attrs]] });
  }
  return { pieces };
}

// ── Catalog expansion ───────────────────────────────────────────────────────
// Everything below is tintable where it can be: drawn in white and greys, so one wearable
// serves every colour variant in the catalog (the variant's `color` tints it at runtime).

const TINT = paint(C.tintBase, C.tintLine);
const TINT_LINE = ink(C.tintLine, 0.5);
/** Darker detail on a tinted piece: multiplies to a deeper shade of the variant colour. */
const TINT_SHADE = `fill="${C.tintLine}"`;

const R = HEAD_R + 0.6;
const CY = HEAD_CY;
const BROW_Y = EYE_Y - 3;

function roundRect(x: number, y: number, w: number, h: number, r: number): Shape {
  return {
    kind: 'path',
    d: `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
      `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
      `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`,
  };
}

/**
 * Front-view hair: a mass of hair with the face cut out of it, so styles differ by their
 * silhouette and by how low the fringe comes (`fringeY`, the top of the face window).
 */
function hairMass(massD: string, fringeY: number): [Shape, string] {
  const bottom = CY + 10;
  const window = ellipseD(4, (fringeY + bottom) / 2, 6.5, (bottom - fringeY) / 2);
  // The mask removes the face (the window, within the head) from the hair; the clipped
  // stroke outlines the hairline.
  const svg =
    `<defs><clipPath id="head"><path d="${circleD(0, CY, HEAD_R)}"/></clipPath>` +
    `<clipPath id="hair-mass"><path d="${massD}"/></clipPath>` +
    `<mask id="face-window" maskUnits="userSpaceOnUse" x="-40" y="-60" width="80" height="100">` +
    `<rect x="-40" y="-60" width="80" height="100" fill="white"/>` +
    `<path d="${window}" fill="black" clip-path="url(#head)"/></mask></defs>` +
    `<path d="${massD}" ${TINT} mask="url(#face-window)"/>` +
    `<g clip-path="url(#head)"><path d="${window}" ${ink(C.tintLine, OUTLINE)} clip-path="url(#hair-mass)"/></g>`;
  return [{ kind: 'raw', svg }, ''];
}

/**
 * Cel-shaded `hairMass`: the same face window, with a shadow on the left and strand lines
 * drawn inside the hair.
 */
function celHairMass(massD: string, fringeY: number, strands: string[]): [Shape, string] {
  const bottom = CY + 10;
  const window = ellipseD(4, (fringeY + bottom) / 2, 6.5, (bottom - fringeY) / 2);
  const [head, mass, face] = [uid('head'), uid('mass'), uid('face')];
  const svg =
    `<defs><clipPath id="${head}"><path d="${circleD(0, CY, HEAD_R)}"/></clipPath>` +
    `<clipPath id="${mass}"><path d="${massD}"/></clipPath>` +
    `<mask id="${face}" maskUnits="userSpaceOnUse" x="-40" y="-60" width="80" height="100">` +
    `<rect x="-40" y="-60" width="80" height="100" fill="white"/>` +
    `<path d="${window}" fill="black" clip-path="url(#${head})"/></mask></defs>` +
    `<g mask="url(#${face})"><path d="${massD}" fill="${GREY.base}"/>` +
    `<g clip-path="url(#${mass})"><path d="${crescent(0, CY, R + 1)}" fill="${GREY.shade}" fill-rule="evenodd"/>` +
    strands.map(d => strokeSvg(d, GREY.line, 0.4)).join('') + '</g>' +
    strokeSvg(massD, GREY.line, LINE_W) + '</g>' +
    `<g clip-path="url(#${head})"><g clip-path="url(#${mass})">${strokeSvg(window, GREY.line, LINE_W)}</g></g>`;
  return [{ kind: 'raw', svg }, ''];
}

/** Strands sweeping from the crown, shared by the cap of most cel hair styles. */
const CROWN_STRANDS = [
  `M -1 ${CY - R + 0.6} Q 3 ${CY - 6} 6.5 ${CY - 3.5}`,
  `M -2 ${CY - R + 1} Q -5.5 ${CY - 4} -7 ${CY + 3}`,
  `M 1 ${CY - R + 0.8} Q 6.5 ${CY - R + 2} 9 ${CY - 3}`,
];

/** Back-view hair over the whole head down to `depth` below its centre. */
function hairBack(depth: number, r = R): Shape {
  return { kind: 'path', d: `M ${-r} ${CY + depth} L ${-r} ${CY} A ${r} ${r} 0 0 1 ${r} ${CY} L ${r} ${CY + depth} Z` };
}

const tinted = (...shapes: Shape[]): Array<[Shape, string]> => shapes.map(s => [s, TINT]);

function headPieces(layer: SlotLayer, front: Array<[Shape, string]>, back: Array<[Shape, string]> = []): Wearable {
  const pieces: Piece[] = [{ bone: 'head', layer, views: FRONT, shapes: front }];
  if (back.length > 0) pieces.push({ bone: 'head', layer, views: ['back'], shapes: back });
  return { tintable: true, pieces };
}

/**
 * Long hair: the cap stays on the head and the length hangs from `hairBack`, which turns
 * half as far as the head. From the front the length is behind the body; from the back
 * it covers it.
 */
function longHair(
  frontCap: Array<[Shape, string]>, frontLength: Array<[Shape, string]>,
  backCap: Array<[Shape, string]>, backLength: Array<[Shape, string]>,
): Wearable {
  return {
    tintable: true,
    pieces: [
      { bone: 'head', layer: 'hair', views: FRONT, shapes: frontCap },
      { bone: 'hairBack', layer: 'hair', views: FRONT, band: 'behind', shapes: frontLength },
      { bone: 'head', layer: 'hair', views: ['back'], shapes: backCap },
      { bone: 'hairBack', layer: 'hair', views: ['back'], shapes: backLength },
    ],
  };
}

/** Hair styles, all tintable: the catalog gives each one a set of hair colours. */
function hairStyle(style: string): Wearable {
  const head = circleD(0, CY, R);
  const cap = circleD(0, CY, R + 1);
  const longFront =
    `M ${R + 1} ${CY} A ${R + 1} ${R + 1} 0 0 0 ${-(R + 1)} ${CY} L ${-(R + 1.5)} ${CY + 24} ` +
    `Q -6 ${CY + 26} -2 ${CY + 23} L -1 ${CY + 8} L ${R + 1} ${CY + 6} Z`;
  const longBack =
    `M ${-(R + 1)} ${CY} A ${R + 1} ${R + 1} 0 0 1 ${R + 1} ${CY} L ${R + 1.5} ${CY + 24} ` +
    `Q 0 ${CY + 27} ${-(R + 1.5)} ${CY + 24} Z`;
  const curls = (from: number, to: number, ring: number) => {
    const out: Shape[] = [];
    for (let a = from; a <= to; a += 22) {
      const rad = (a * Math.PI) / 180;
      out.push(disc(ring * Math.cos(rad), CY - ring * Math.sin(rad), 3.4));
    }
    return out;
  };

  switch (style) {
    case 'buzz':
      return headPieces('hair', [hairMass(circleD(0, CY, R - 0.3), CY - 5)], tinted(hairBack(3, R - 0.3)));
    case 'fade':
      return headPieces('hair',
        tinted({ kind: 'path', d: `M ${-R} ${CY - 1} A ${R} ${R} 0 0 1 ${R - 1} ${CY - 4} Q 3 ${CY - 7} -2 ${CY - 6} Q -6 ${CY - 5} ${-R} ${CY - 1} Z` }),
        tinted(hairBack(-1)));
    case 'side-part':
      return headPieces('hair', [
        hairMass(head, CY - 4),
        [{ kind: 'path', d: `M -3 ${CY - R + 0.5} Q 5 ${CY - R - 1.5} ${R + 0.5} ${CY - 4} Q 6 ${CY - 5} 1 ${CY - 6} Q -1 ${CY - 7} -3 ${CY - R + 0.5} Z` }, TINT],
      ], tinted(hairBack(5)));
    case 'quiff':
      return headPieces('hair', [
        hairMass(head, CY - 5),
        [{ kind: 'path', d: `M -3 ${CY - R + 1} Q 0 ${CY - R - 6} 9 ${CY - R - 3} Q 11 ${CY - R} 8 ${CY - R + 3} Q 2 ${CY - R + 2} -3 ${CY - R + 1} Z` }, TINT],
      ], tinted(hairBack(3)));
    case 'pixie':
      return headPieces('hair', [hairMass(circleD(0, CY, R + 0.3), CY - 3)], tinted(hairBack(5, R + 0.3)));
    case 'bob':
      return headPieces('hair',
        [hairMass(`M ${-(R + 1)} ${CY + 10} L ${-(R + 1)} ${CY} A ${R + 1} ${R + 1} 0 0 1 ${R + 1} ${CY} L ${R + 1} ${CY + 10} Z`, CY - 4)],
        tinted(hairBack(10, R + 1)));
    case 'long': {
      // From behind, the cap runs down to the jaw so no skin shows above the length. Its
      // bottom is left unlined, with pointed tips drawn as lines, so the two read as one.
      const r = R + 1;
      const capBack = `M ${r} ${CY + 9.5} L ${r} ${CY} A ${r} ${r} 0 0 0 ${-r} ${CY} L ${-r} ${CY + 9.5} Z`;
      const tips = 'M ' + [-r, -6.5, -3, 0.5, 4, 7.5, r].map((x, i) => `${x} ${CY + (i % 2 === 0 ? 9.5 : 6.5)}`).join(' L ');
      const strand = (x: number, sway: number) => `M ${x} ${CY + 2} Q ${x + sway} ${CY + 13} ${x} ${CY + 23}`;
      return longHair(
        [celHairMass(cap, CY - 4, CROWN_STRANDS)],
        // Behind the shoulders from the front, so mostly in shadow.
        [[cel(longFront, GREY, { shade: [leftOf(-6.5)], lines: [strand(-8, -1), strand(-4.5, 0.8)] }), '']],
        [[cel(capBack, GREY, {
          shade: [crescent(0, CY, R + 1)],
          lines: [tips, `M -1 ${CY - R + 0.5} Q -5 ${CY - 5} -6.5 ${CY + 4}`, `M 1 ${CY - R + 0.5} Q 5 ${CY - 5} 6.5 ${CY + 4}`],
          edge: `M ${r} ${CY + 9.5} L ${r} ${CY} A ${r} ${r} 0 0 0 ${-r} ${CY} L ${-r} ${CY + 9.5}`,
        }), '']],
        [[cel(longBack, GREY, { shade: [leftOf(-5)], lines: [strand(-6, -1), strand(-1.5, 0.6), strand(3.5, 1), strand(7.5, -0.8)] }), '']],
      );
    }
    case 'waves':
      return longHair([hairMass(cap, CY - 4)],
        tinted({
          kind: 'path',
          d: `M ${R + 1} ${CY} A ${R + 1} ${R + 1} 0 0 0 ${-(R + 1)} ${CY} Q ${-(R + 3)} ${CY + 6} ${-(R + 1)} ${CY + 12} ` +
            `Q ${-(R - 1)} ${CY + 18} ${-(R + 2)} ${CY + 24} Q -6 ${CY + 27} -2 ${CY + 23} Q -3 ${CY + 15} -1 ${CY + 8} L ${R + 1} ${CY + 6} Z`,
        }),
        tinted(hairBack(4, R + 1)),
        tinted({
          kind: 'path',
          d: `M ${-(R + 1)} ${CY} A ${R + 1} ${R + 1} 0 0 1 ${R + 1} ${CY} Q ${R + 3} ${CY + 6} ${R + 1} ${CY + 12} ` +
            `Q ${R - 1} ${CY + 18} ${R + 2} ${CY + 24} Q 0 ${CY + 28} ${-(R + 2)} ${CY + 24} ` +
            `Q ${-(R - 1)} ${CY + 18} ${-(R + 1)} ${CY + 12} Q ${-(R + 3)} ${CY + 6} ${-(R + 1)} ${CY} Z`,
        }));
    case 'ponytail':
      return longHair([hairMass(head, CY - 5)],
        tinted({ kind: 'path', d: `M ${-R + 1} ${CY - 5} Q ${-R - 6} ${CY - 2} ${-R - 3} ${CY + 16} Q ${-R - 1} ${CY + 18} ${-R} ${CY + 15} Q ${-R - 2} ${CY + 2} ${-R + 3} ${CY - 2} Z` }),
        tinted(hairBack(4)), tinted(roundRect(-2.5, CY + 2, 5, 16, 2.5)));
    case 'man-bun':
      return headPieces('hair', [hairMass(head, CY - 5), [disc(-5, CY - R + 0.5, 3.8), TINT]],
        tinted(hairBack(4), disc(0, CY - R, 4)));
    case 'space-buns':
      return headPieces('hair', [hairMass(head, CY - 5), [disc(-6, CY - R + 2, 3.8), TINT], [disc(4, CY - R, 3.8), TINT]],
        tinted(hairBack(4), disc(-6, CY - R + 2, 3.8), disc(6, CY - R + 2, 3.8)));
    case 'afro':
      return headPieces('hair', [hairMass(circleD(-1, CY - 2, 14), CY - 4)], tinted(disc(0, CY - 2, 14)));
    case 'curly':
      return headPieces('hair', [hairMass(head, CY - 4), ...tinted(...curls(40, 260, R - 1))],
        tinted(hairBack(4), ...curls(-10, 190, R - 1)));
    case 'braids':
      return longHair([hairMass(head, CY - 5)], tinted(roundRect(-R - 1.5, CY, 4, 20, 2)),
        tinted(hairBack(4)), tinted(roundRect(-6, CY + 2, 4, 18, 2), roundRect(2, CY + 2, 4, 18, 2)));
    case 'mohawk':
      return headPieces('hair',
        tinted({ kind: 'path', d: `M -6 ${CY - 6} L -7 ${CY - R - 4} L -3 ${CY - R - 1} L -1 ${CY - R - 6} L 2 ${CY - R - 1} L 5 ${CY - R - 5} L 6 ${CY - R + 1} Q 0 ${CY - R + 2} -6 ${CY - 6} Z` }),
        tinted(roundRect(-2.5, CY - R - 4, 5, R + 8, 2.5)));
    default:
      throw new Error(`unknown hair style ${style}`);
  }
}

function facialHair(style: 'stubble' | 'full' | 'goatee' | 'moustache' | 'handlebar' | 'chops'): Wearable {
  const moustache: Shape = { kind: 'path', d: `M 0.8 ${CY + 6} Q 2 ${CY + 4.4} 4 ${CY + 5} Q 6 ${CY + 4.4} 7.4 ${CY + 6} Q 4 ${CY + 5.6} 0.8 ${CY + 6} Z` };
  const beard: Shape = {
    kind: 'path',
    d: `M -1.5 ${CY + 2} Q -1 ${CY + 11} 4.5 ${CY + 11.5} Q 10 ${CY + 11} 10 ${CY + 2} L 9 ${CY + 2} ` +
      `Q 8.5 ${CY + 8.5} 4.5 ${CY + 8.5} Q 0.5 ${CY + 8.5} 0 ${CY + 2} Z`,
  };
  const shapes: Record<typeof style, Array<[Shape, string]>> = {
    stubble: [[beard, `fill="${C.tintBase}" fill-opacity="0.45"`], [moustache, `fill="${C.tintBase}" fill-opacity="0.45"`]],
    full: tinted(beard, moustache),
    goatee: tinted({ kind: 'path', d: `M 2.3 ${CY + 8.3} Q 4.5 ${CY + 12.5} 6.7 ${CY + 8.3} Q 4.5 ${CY + 9.3} 2.3 ${CY + 8.3} Z` }, moustache),
    moustache: tinted(moustache),
    handlebar: tinted(moustache, { kind: 'path', d: `M 0.8 ${CY + 6} Q -0.8 ${CY + 6.5} -0.4 ${CY + 4.6} Q 0 ${CY + 5.8} 1.4 ${CY + 5.6} Z M 7.4 ${CY + 6} Q 9 ${CY + 6.5} 8.6 ${CY + 4.6} Q 8.2 ${CY + 5.8} 6.8 ${CY + 5.6} Z` }),
    chops: tinted(roundRect(-2, CY - 2, 3, 10, 1.5), roundRect(8.2, CY - 2, 2.2, 9, 1.1)),
  };
  return headPieces('facialHair', shapes[style]);
}

function headwear(style: 'cap' | 'cap-back' | 'beanie' | 'bucket' | 'headphones' | 'crown' | 'cowboy' | 'beret'): Wearable {
  const dome = (r: number, y: number): Shape => ({ kind: 'path', d: `M ${-r} ${y} A ${r} ${r} 0 0 1 ${r} ${y} Z` });
  const brimFront: Shape = { kind: 'path', d: `M ${R - 1} ${CY - 2.5} Q ${R + 6} ${CY - 3} ${R + 7} ${CY - 0.5} Q ${R + 3} ${CY} ${R - 1} ${CY - 0.5} Z` };
  const brimBack: Shape = { kind: 'path', d: `M ${-(R - 1)} ${CY - 2.5} Q ${-(R + 6)} ${CY - 3} ${-(R + 7)} ${CY - 0.5} Q ${-(R + 3)} ${CY} ${-(R - 1)} ${CY - 0.5} Z` };
  const crown: Shape = { kind: 'path', d: `M -7 ${CY - R + 3} L -7.5 ${CY - R - 4} L -4 ${CY - R - 1} L -1 ${CY - R - 6} L 2 ${CY - R - 1} L 5.5 ${CY - R - 4} L 6 ${CY - R + 3} Z` };
  const band = (w: number) => ({ kind: 'path', d: `M ${-w} ${CY} A ${w} ${w} 0 0 1 ${w} ${CY}` }) as Shape;
  const BAND = `fill="none" stroke="${C.tintBase}" stroke-width="1.8"`;
  switch (style) {
    case 'cap':
      return headPieces('headwear', tinted(dome(R + 0.5, CY - 1), brimFront), tinted(dome(R + 0.5, CY - 1)));
    case 'cap-back':
      return headPieces('headwear', tinted(dome(R + 0.5, CY - 1), brimBack), tinted(dome(R + 0.5, CY - 1), brimBack));
    case 'beanie': {
      const shapes = tinted(dome(R + 0.7, CY - 2.5), roundRect(-(R + 1), CY - 4.8, 2 * (R + 1), 3.2, 1.2), disc(0, CY - R - 3, 2.2));
      return headPieces('headwear', shapes, shapes);
    }
    case 'bucket': {
      const shapes = tinted({ kind: 'oval', x: -(R + 4), y: CY - 4, w: 2 * R + 8, h: 4.5 }, dome(R - 0.5, CY - 2));
      return headPieces('headwear', shapes, shapes);
    }
    case 'headphones':
      return headPieces('headwear',
        [[band(R + 0.8), BAND], [band(R + 0.8), TINT_LINE], ...tinted({ kind: 'oval', x: -4.5, y: CY - 3, w: 4.5, h: 7 })],
        [[band(R + 0.8), BAND], ...tinted({ kind: 'oval', x: -(R + 2), y: CY - 3, w: 4, h: 7 }, { kind: 'oval', x: R - 2, y: CY - 3, w: 4, h: 7 })]);
    case 'crown': {
      const shapes: Array<[Shape, string]> = [[crown, TINT], [disc(-1, CY - R - 0.5, 1.1), `fill="${C.feature}" fill-opacity="0.4"`]];
      return headPieces('headwear', shapes, shapes);
    }
    case 'cowboy': {
      const shapes = tinted(
        { kind: 'path', d: `M ${-(R + 7)} ${CY - 4} Q 0 ${CY} ${R + 7} ${CY - 4} Q ${R + 5} ${CY - 1} 0 ${CY - 1} Q ${-(R + 5)} ${CY - 1} ${-(R + 7)} ${CY - 4} Z` },
        { kind: 'path', d: `M -7 ${CY - 3} L -6 ${CY - R - 5} Q 0 ${CY - R - 2} 6 ${CY - R - 5} L 7 ${CY - 3} Z` },
      );
      return headPieces('headwear', shapes, shapes);
    }
    case 'beret': {
      const shapes = tinted({ kind: 'oval', x: -(R + 1), y: CY - R - 2.5, w: 2 * R + 1, h: 7 }, disc(-1, CY - R - 3, 1));
      return headPieces('headwear', shapes, shapes);
    }
  }
}

function facewear(style: 'round' | 'sunglasses' | 'aviators' | 'patch' | 'mask' | 'monocle'): Wearable {
  const FRAME = `fill="none" stroke="${C.tintBase}" stroke-width="0.9"`;
  const FRAME_EDGE = ink(C.tintLine, 0.3);
  const bridge: Shape = { kind: 'path', d: `M 3 ${EYE_Y - 0.5} Q 3.5 ${EYE_Y - 1.2} 4 ${EYE_Y - 0.5} M -0.6 ${EYE_Y - 0.6} L -2.5 ${EYE_Y - 1.2}` };
  const lenses = (rx: number, ry: number) => EYES_X.map(x => ({ kind: 'oval', x: x - rx, y: EYE_Y - ry, w: 2 * rx, h: 2 * ry }) as Shape);
  switch (style) {
    case 'round':
      return headPieces('facewear', [...lenses(1.9, 1.9).map(s => [s, FRAME] as [Shape, string]), [bridge, FRAME], ...lenses(1.9, 1.9).map(s => [s, FRAME_EDGE] as [Shape, string])]);
    case 'sunglasses':
      return headPieces('facewear', [
        ...EYES_X.map(x => [roundRect(x - 2.1, EYE_Y - 1.6, 4.2, 3.2, 1), `fill="${C.feature}" stroke="${C.tintBase}" stroke-width="0.6"`] as [Shape, string]),
        [bridge, FRAME],
      ]);
    case 'aviators':
      return headPieces('facewear', [
        ...EYES_X.map(x => [{ kind: 'path', d: `M ${x - 2} ${EYE_Y - 1.5} H ${x + 2} Q ${x + 2.2} ${EYE_Y + 2.5} ${x} ${EYE_Y + 2.3} Q ${x - 2.2} ${EYE_Y + 2} ${x - 2} ${EYE_Y - 1.5} Z` }, `fill="${C.tintBase}" fill-opacity="0.75" stroke="${C.tintLine}" stroke-width="0.4"`] as [Shape, string]),
        [bridge, FRAME],
      ]);
    case 'patch':
      return headPieces('facewear', [
        [{ kind: 'path', d: `M -6 ${BROW_Y - 2} L 8 ${EYE_Y + 1}` }, ink(C.tintBase, 0.6)],
        [disc(EYES_X[1], EYE_Y, 2.3), TINT],
      ]);
    case 'mask':
      return headPieces('facewear', [
        [{ kind: 'path', d: `M -1 ${CY + 3} Q 4 ${CY + 1.5} 10 ${CY + 3} L 9.5 ${CY + 7} Q 5 ${CY + 10.5} 0 ${CY + 8} Z` }, TINT],
        [{ kind: 'path', d: `M -1 ${CY + 3.5} L -3 ${CY + 1} M 0 ${CY + 7.5} L -3 ${CY + 4}` }, ink(C.tintBase, 0.5)],
      ]);
    case 'monocle':
      return headPieces('facewear', [
        [disc(EYES_X[1], EYE_Y, 2), FRAME],
        [disc(EYES_X[1], EYE_Y, 2), FRAME_EDGE],
        [{ kind: 'path', d: `M ${EYES_X[1]} ${EYE_Y + 2} Q ${EYES_X[1] - 1} ${CY + 8} ${EYES_X[1] - 3} ${CY + 10}` }, ink(C.tintBase, 0.4)],
      ]);
  }
}

/** Wrist pieces sit at the end of the forearm, over any sleeve. */
function wristwear(style: 'watch' | 'smartwatch' | 'bracelet' | 'sweatband' | 'beads'): Wearable {
  const band = (h: number): Shape => roundRect(-2.7, 10 - h / 2, 5.4, h, Math.min(1, h / 2));
  const shapes: Record<typeof style, Array<[Shape, string]>> = {
    watch: [[band(1.6), TINT], [disc(0, 10, 1.5), TINT], [disc(0, 10, 0.9), `fill="${C.eyeWhite}"`]],
    smartwatch: [[band(1.6), TINT], [roundRect(-1.6, 8.4, 3.2, 3.2, 0.8), `fill="${C.feature}" stroke="${C.tintBase}" stroke-width="0.5"`]],
    bracelet: [[band(0.9), TINT]],
    sweatband: [[band(3), TINT], [{ kind: 'path', d: 'M -2.7 10 H 2.7' }, TINT_LINE]],
    beads: [-2, -0.7, 0.6, 1.9].map(x => [disc(x, 10, 0.75), TINT] as [Shape, string]),
  };
  // A watch goes on one wrist; the rest are worn on both.
  const arms: BoneName[] = style === 'watch' || style === 'smartwatch' ? ['foreArm.L'] : sided('foreArm');
  return { tintable: true, pieces: arms.map(bone => ({ bone, layer: 'wristwear', views: BOTH, shapes: shapes[style] })) };
}

/**
 * Neck pieces. The chain or wrap sits on the neck; what hangs lies on the chest. The
 * scarf's end is in the front band, so it stays over the near arm as it swings.
 */
function neckwear(style: 'necklace' | 'pendant' | 'scarf'): Wearable {
  const chain: Shape = { kind: 'path', d: 'M -4 -15.5 Q 2.5 -8 6 -15.5' };
  switch (style) {
    case 'necklace':
      return { tintable: true, pieces: [
        { bone: 'chest', layer: 'neckwear', views: FRONT, shapes: [[chain, ink(C.tintBase, 0.6)]] },
        { bone: 'neck', layer: 'neckwear', views: ['back'], shapes: [[{ kind: 'path', d: 'M -2.6 -0.6 H 2.6' }, ink(C.tintBase, 0.6)]] },
      ] };
    case 'pendant':
      return { tintable: true, pieces: [
        { bone: 'chest', layer: 'neckwear', views: FRONT, shapes: [[chain, ink(C.tintBase, 0.4)], [disc(2.3, -10.8, 1.3), TINT]] },
        { bone: 'neck', layer: 'neckwear', views: ['back'], shapes: [[{ kind: 'path', d: 'M -2.6 -0.6 H 2.6' }, ink(C.tintBase, 0.4)]] },
      ] };
    case 'scarf':
      return { tintable: true, pieces: [
        { bone: 'neck', layer: 'neckwear', views: BOTH, shapes: [[capsule(7.5, -3.5, 1.5), TINT], [{ kind: 'path', d: 'M -3.7 -1 H 3.7' }, TINT_LINE]] },
        { bone: 'chest', layer: 'neckwear', views: FRONT, band: 'front', shapes: [[roundRect(1, -15.5, 4, 14, 1.2), TINT], [{ kind: 'path', d: 'M 1 -3.5 H 5' }, TINT_LINE]] },
        { bone: 'chest', layer: 'neckwear', views: ['back'], shapes: [[roundRect(-4, -15.5, 4, 9, 1.2), TINT]] },
      ] };
  }
}

function footwear(style: 'sneakers' | 'high-tops' | 'boots' | 'sandals' | 'slides' | 'dress'): Wearable {
  const shoe: Shape = { kind: 'path', d: 'M -3.6 -2.6 L 2.5 -2.6 Q 7.5 -1.2 8 2 L 8 3.4 L -3.8 3.4 Z' };
  const sole = roundRect(-3.9, 2.4, 12, 1.4, 0.6);
  const lowShoe: Shape = { kind: 'path', d: 'M -3.4 -1.2 L 2.5 -1.6 Q 7.8 -0.5 8.2 2.2 L 8.2 3.2 L -3.6 3.2 Z' };
  const feet: Record<typeof style, Array<[Shape, string]>> = {
    // Cel-shaded: toe cap, laces and a side stripe on the upper, then a midsole.
    'sneakers': [
      [cel((shoe as { d: string }).d, GREY, {
        shade: [leftOf(-1.6), 'M -2.8 1.8 Q 1 -0.6 4.4 1.8 L 4.4 2.8 Q 1 0.6 -2.8 2.8 Z'],
        lines: ['M 4.7 -0.9 Q 4.1 1.2 4.6 3'],
        raw: strokeSvg('M 0.4 -2.2 L 1.6 -1.4 M 1.6 -2.3 L 2.8 -1.3 M 2.8 -2.2 L 3.9 -1', GREY.line, 0.45),
      }), ''],
      [cel('M -3.9 2.4 H 7.4 Q 8.4 2.4 8.4 3.2 Q 8.4 4 7.4 4 H -3.9 Q -4.5 4 -4.5 3.2 Q -4.5 2.4 -3.9 2.4 Z', GREY, {
        lines: ['M -4 3.2 H 8'],
      }, 0.5), ''],
    ],
    'high-tops': [[shoe, TINT], [sole, `fill="${C.eyeWhite}" stroke="${C.tintLine}" stroke-width="0.4"`]],
    'boots': [[shoe, TINT], [sole, TINT_SHADE]],
    'sandals': [[sole, TINT], [{ kind: 'path', d: 'M 0 2.4 Q 3 -1.5 6 2.4' }, ink(C.tintBase, 1)]],
    'slides': [[sole, TINT], [{ kind: 'path', d: 'M 1 2.6 Q 4 -1.8 7.2 2.6 Z' }, TINT]],
    'dress': [[lowShoe, TINT], [{ kind: 'path', d: 'M -3.6 3.2 H 8.2' }, ink(C.tintLine, 0.8)]],
  };
  const pieces: Piece[] = sided('foot').map(bone => ({ bone, layer: 'footwear', views: BOTH, shapes: feet[style] }));
  const shaft = style === 'boots' ? 7 : style === 'high-tops' ? 11 : null;
  if (shaft !== null) {
    for (const bone of sided('shin')) {
      pieces.push({ bone, layer: 'footwear', views: BOTH, shapes: [[capsule(7.4, shaft, 16.5), TINT]] });
    }
  }
  return { tintable: true, pieces };
}

type TopStyle = 'hoodie' | 'tank' | 'polo' | 'sweater' | 'button-up' | 'blazer' | 'jersey' | 'track-jacket' | 'puffer' | 'crop' | 'long-coat';

function tintedTop(style: TopStyle): Wearable {
  const SLEEVES: Partial<Record<TopStyle, 'none' | 'short'>> = { tank: 'none', crop: 'short', polo: 'short', jersey: 'short' };
  const sleeves: 'none' | 'short' | 'long' = SLEEVES[style] ?? 'long';
  const bulk = style === 'puffer' ? 1.5 : 0;
  const pieces: Piece[] = [
    { bone: 'chest', layer: 'tops', views: BOTH, shapes: [[capsule(16.5 + bulk - (sleeves === 'none' ? 1 : 0), -16.5, 2), TINT]] },
  ];
  if (style !== 'crop') pieces.push({ bone: 'spine', layer: 'tops', views: BOTH, shapes: [[capsule(14.5 + bulk, -11, 4), TINT]] });
  if (sleeves !== 'none') {
    for (const arm of sided('upperArm')) {
      pieces.push({ bone: arm, layer: 'tops', views: BOTH, shapes: [[capsule(6.5 + bulk / 2, -2.5, sleeves === 'short' ? 7 : 13.5), TINT]] });
    }
  }
  if (sleeves === 'long') {
    for (const arm of sided('foreArm')) {
      const shapes: Array<[Shape, string]> = [[capsule(5.8 + bulk / 2, -1.5, 11), TINT]];
      if (style === 'track-jacket') shapes.push([roundRect(-0.6, -1.5, 1.2, 12, 0.6), `fill="${C.eyeWhite}"`]);
      pieces.push({ bone: arm, layer: 'tops', views: BOTH, shapes });
    }
    if (style === 'track-jacket') {
      for (const arm of sided('upperArm')) {
        pieces.find(p => p.bone === arm)!.shapes.push([roundRect(-0.6, -2.5, 1.2, 16, 0.6), `fill="${C.eyeWhite}"`]);
      }
    }
  }

  // Details on the chest (front view: the torso faces screen right, so they sit right of centre).
  const chest = pieces[0].shapes;
  const spine = pieces.find(p => p.bone === 'spine')?.shapes;
  const collar: Shape = { kind: 'path', d: 'M -2 -16.5 L 2.5 -12.5 L 6 -16.5' };
  switch (style) {
    case 'hoodie':
      chest.push([{ kind: 'path', d: 'M -6 -16 Q 0 -20 6 -16 Q 0 -13.5 -6 -16 Z' }, TINT]);
      spine?.push([roundRect(-3, -7, 9, 4.5, 1.5), TINT]);
      pieces.push({ bone: 'chest', layer: 'tops', views: ['back'], shapes: [[{ kind: 'path', d: 'M -6 -16 Q 0 -21 6 -16 Q 0 -8 -6 -16 Z' }, TINT]] });
      break;
    case 'polo':
      chest.push([collar, TINT_LINE], [{ kind: 'path', d: 'M 2.5 -12.5 V -8' }, TINT_LINE]);
      break;
    case 'sweater':
      spine?.push([{ kind: 'path', d: 'M -7 2.5 H 7' }, TINT_LINE]);
      break;
    case 'button-up':
      chest.push([collar, TINT_LINE], [{ kind: 'path', d: 'M 2.5 -12.5 V 2' }, TINT_LINE],
        ...[-10, -6, -2].map(y => [disc(3.3, y, 0.45), TINT_SHADE] as [Shape, string]));
      break;
    case 'blazer':
      chest.push([{ kind: 'path', d: 'M -1 -16.5 L 2.5 -6 L 6.5 -16.5' }, `fill="${C.eyeWhite}" stroke="${C.tintLine}" stroke-width="0.5"`],
        [{ kind: 'path', d: 'M -1 -16.5 L 1.5 -9 M 6.5 -16.5 L 4 -9' }, TINT_LINE]);
      break;
    case 'jersey':
      chest.push([roundRect(-7.5, -11, 15, 2, 0.5), TINT_SHADE], [roundRect(-7.5, -8, 15, 2, 0.5), TINT_SHADE]);
      break;
    case 'puffer':
      chest.push([{ kind: 'path', d: 'M -8.5 -11 H 8.5 M -8.5 -5 H 8.5' }, TINT_LINE]);
      spine?.push([{ kind: 'path', d: 'M -7.5 -2 H 7.5' }, TINT_LINE]);
      break;
    case 'long-coat':
      chest.push([{ kind: 'path', d: 'M -1 -16.5 L 2.5 -6 L 6.5 -16.5' }, TINT_LINE], [{ kind: 'path', d: 'M 2.5 -6 V 2' }, TINT_LINE]);
      // Waist on the hip, then two tails on the skirt bones down past the knees. They
      // overlap in the middle, so no gap opens when the legs part.
      pieces.push({ bone: 'hip', layer: 'tops', views: BOTH, shapes: [[capsule(15, -4, 5), TINT], [{ kind: 'path', d: 'M 2.5 -4 V 5' }, TINT_LINE]] });
      for (const [bone, d] of [['skirt.L', 'M -5.5 -4 L 3.5 -4 L 6 26 L -5.5 26 Z'], ['skirt.R', 'M -3.5 -4 L 5.5 -4 L 5.5 26 L -6 26 Z']] as const) {
        pieces.push({ bone, layer: 'tops', views: BOTH, shapes: [[{ kind: 'path', d }, TINT]] });
      }
      break;
    case 'tank':
    case 'crop':
    case 'track-jacket':
      break;
  }
  return { tintable: true, pieces };
}

type BottomStyle = 'shorts' | 'cargo-shorts' | 'joggers' | 'chinos' | 'track-pants' | 'ripped' | 'skirt' | 'leggings';

function tintedBottoms(style: BottomStyle): Wearable {
  const thighW = style === 'leggings' ? 7.4 : style === 'chinos' ? 7.8 : 8.2;
  const shinW = style === 'leggings' ? 6.4 : style === 'chinos' ? 6.8 : 7.2;
  const short = style === 'shorts' || style === 'cargo-shorts';
  const pieces: Piece[] = [{ bone: 'hip', layer: 'bottoms', views: BOTH, shapes: [[capsule(14, -3.5, 5), TINT]] }];
  if (style === 'skirt') {
    // Two overlapping panels on the skirt bones, so the hem swings with the legs.
    pieces.push(
      { bone: 'skirt.L', layer: 'bottoms', views: BOTH, shapes: [[{ kind: 'path', d: 'M -5 -3 L 3 -3 L 6.5 15 Q 1 16.5 -5 16 Z' }, TINT]] },
      { bone: 'skirt.R', layer: 'bottoms', views: BOTH, shapes: [[{ kind: 'path', d: 'M -3 -3 L 5 -3 L 5 16 Q -1 16.5 -6.5 15 Z' }, TINT]] },
    );
    return { tintable: true, pieces };
  }
  for (const leg of sided('thigh')) {
    const shapes: Array<[Shape, string]> = [[capsule(thighW, -3, short ? 11 : 18.5), TINT]];
    if (style === 'cargo-shorts') shapes.push([roundRect(-3, 3, 6, 5, 0.8), TINT]);
    if (style === 'track-pants') shapes.push([roundRect(-0.6, -3, 1.2, 21, 0.6), `fill="${C.eyeWhite}"`]);
    if (style === 'ripped') shapes.push([{ kind: 'path', d: 'M -2.5 14 L 2.5 13.5 M -2 16 L 2 16.2' }, ink(C.tintLine, 0.6)]);
    pieces.push({ bone: leg, layer: 'bottoms', views: BOTH, shapes });
  }
  if (!short) {
    for (const leg of sided('shin')) {
      const shapes: Array<[Shape, string]> = [[capsule(shinW, -1.5, 15), TINT]];
      if (style === 'joggers') shapes.push([roundRect(-shinW / 2, 12.5, shinW, 2.5, 1), TINT_SHADE]);
      if (style === 'track-pants') shapes.push([roundRect(-0.6, -1.5, 1.2, 16, 0.6), `fill="${C.eyeWhite}"`]);
      if (style === 'ripped') shapes.push([{ kind: 'path', d: 'M -2 1 L 2 0.5' }, ink(C.tintLine, 0.6)]);
      pieces.push({ bone: leg, layer: 'bottoms', views: BOTH, shapes });
    }
  }
  return { tintable: true, pieces };
}

const FACE_SHAPES = {
  normal: circleD(0, CY, HEAD_R),
  round: ellipseD(0, CY, HEAD_R + 1, HEAD_R + 0.3),
  oval: ellipseD(0, CY, HEAD_R - 0.6, HEAD_R + 0.6),
  long: ellipseD(0, CY, HEAD_R - 1.2, HEAD_R + 1.3),
  square: (roundRect(-HEAD_R, CY - HEAD_R, 2 * HEAD_R, 2 * HEAD_R, 4) as { d: string }).d,
  heart: `M -9.3 ${CY - 3} A 9.3 8 0 0 1 9.3 ${CY - 3} Q 9 ${CY + 5} 0 ${CY + 10} Q -9 ${CY + 5} -9.3 ${CY - 3} Z`,
};

/** More eyes; drawn in fixed colours like the originals (features aren't tinted). */
function moreEyes(style: 'sleepy' | 'wide' | 'wink' | 'lashes' | 'happy' | 'star' | 'cat' | 'heart'): Wearable {
  const at = (fn: (x: number) => Array<[Shape, string]>) => EYES_X.flatMap(fn);
  const star = (x: number): Shape => ({
    kind: 'path',
    d: `M ${x} ${EYE_Y - 2} L ${x + 0.6} ${EYE_Y - 0.6} L ${x + 2} ${EYE_Y} L ${x + 0.6} ${EYE_Y + 0.6} L ${x} ${EYE_Y + 2} ` +
      `L ${x - 0.6} ${EYE_Y + 0.6} L ${x - 2} ${EYE_Y} L ${x - 0.6} ${EYE_Y - 0.6} Z`,
  });
  const heart = (x: number): Shape => ({
    kind: 'path',
    d: `M ${x} ${EYE_Y + 1.6} L ${x - 1.7} ${EYE_Y - 0.1} A 0.9 0.9 0 0 1 ${x} ${EYE_Y - 1.2} A 0.9 0.9 0 0 1 ${x + 1.7} ${EYE_Y - 0.1} Z`,
  });
  const shapes: Record<typeof style, Array<[Shape, string]>> = {
    sleepy: at(x => [
      [{ kind: 'path', d: `M ${x - 1.5} ${EYE_Y} A 1.5 1.5 0 0 0 ${x + 1.5} ${EYE_Y} Z` }, paint(C.eyeWhite, C.feature)],
      [disc(x + 0.3, EYE_Y + 0.6, 0.7), `fill="${C.feature}"`],
      [{ kind: 'path', d: `M ${x - 1.7} ${EYE_Y} H ${x + 1.7}` }, ink(C.feature, 0.6)],
    ]),
    wide: at(x => [
      [{ kind: 'oval', x: x - 1.9, y: EYE_Y - 2.5, w: 3.8, h: 5 }, paint(C.eyeWhite, C.feature)],
      [disc(x + 0.4, EYE_Y + 0.2, 1.2), `fill="${C.feature}"`],
      [disc(x + 0.8, EYE_Y - 0.3, 0.35), `fill="${C.eyeWhite}"`],
    ]),
    wink: [
      [disc(EYES_X[0], EYE_Y, 1.2), `fill="${C.feature}"`],
      [{ kind: 'path', d: `M ${EYES_X[1] - 1.5} ${EYE_Y} Q ${EYES_X[1]} ${EYE_Y - 1.5} ${EYES_X[1] + 1.5} ${EYE_Y}` }, ink(C.feature)],
    ],
    lashes: at(x => [
      [disc(x, EYE_Y, 1.2), `fill="${C.feature}"`],
      [{ kind: 'path', d: `M ${x + 0.8} ${EYE_Y - 0.9} L ${x + 1.8} ${EYE_Y - 1.9} M ${x + 1.1} ${EYE_Y - 0.4} L ${x + 2.2} ${EYE_Y - 1}` }, ink(C.feature, 0.4)],
    ]),
    happy: at(x => [[{ kind: 'path', d: `M ${x - 1.5} ${EYE_Y + 0.6} Q ${x} ${EYE_Y - 1.6} ${x + 1.5} ${EYE_Y + 0.6}` }, ink(C.feature)]]),
    star: at(x => [[star(x), `fill="${C.gold}" stroke="${C.feature}" stroke-width="0.3"`]]),
    cat: at(x => [
      [{ kind: 'path', d: `M ${x - 1.8} ${EYE_Y + 0.3} Q ${x} ${EYE_Y - 2} ${x + 1.8} ${EYE_Y - 0.6} Q ${x} ${EYE_Y + 2} ${x - 1.8} ${EYE_Y + 0.3} Z` }, paint(C.catEye, C.feature)],
      [{ kind: 'oval', x: x - 0.3, y: EYE_Y - 1.1, w: 0.6, h: 2.2 }, `fill="${C.feature}"`],
    ]),
    heart: at(x => [[heart(x), `fill="${C.heartRed}" stroke="${C.feature}" stroke-width="0.3"`]]),
  };
  return { pieces: [{ bone: 'head', layer: 'eye', views: FRONT, shapes: shapes[style] }] };
}

function moreNoses(style: 'button' | 'pointed' | 'freckled' | 'wide'): Wearable {
  const shapes: Record<typeof style, Array<[Shape, string]>> = {
    button: [[disc(6, CY + 3.9, 0.8), `fill="${C.shade}"`]],
    pointed: [[{ kind: 'path', d: `M 5.3 ${CY + 1.5} L 7.8 ${CY + 4.8} L 5.6 ${CY + 4.9}` }, ink(C.feature, 0.5)]],
    freckled: [
      [{ kind: 'path', d: `M 5.5 ${CY + 2} L 7 ${CY + 4.5} L 5.5 ${CY + 4.8}` }, ink(C.feature, 0.5)],
      ...[[1.5, 3.2], [2.6, 3.8], [3.3, 3], [8, 3.2], [8.8, 3.9]].map(([x, y]) => [disc(x, CY + y, 0.3), `fill="${C.freckle}"`] as [Shape, string]),
    ],
    wide: [[{ kind: 'path', d: `M 4 ${CY + 4.4} Q 6 ${CY + 5.6} 8 ${CY + 4.4}` }, ink(C.feature, 0.5)]],
  };
  return { pieces: [{ bone: 'head', layer: 'nose', views: FRONT, shapes: shapes[style] }] };
}

function moreMouths(style: 'smirk' | 'grin' | 'surprised' | 'tongue' | 'neutral' | 'sad'): Wearable {
  const y = CY + 6.5;
  const shapes: Record<typeof style, Array<[Shape, string]>> = {
    smirk: [[{ kind: 'path', d: `M 1.8 ${y + 0.5} Q 4.5 ${y + 1} 6.6 ${y - 0.8}` }, ink(C.feature)]],
    grin: [[{ kind: 'path', d: `M 1.2 ${y - 0.5} Q 4 ${y - 0.2} 6.8 ${y - 1} Q 6 ${y + 2.8} 4 ${y + 2.6} Q 1.6 ${y + 2.4} 1.2 ${y - 0.5} Z` }, paint(C.eyeWhite, C.feature)]],
    surprised: [[{ kind: 'oval', x: 3, y: y - 1, w: 2.4, h: 3 }, `fill="${C.feature}"`]],
    tongue: [
      [{ kind: 'path', d: `M 3 ${y + 0.8} Q 3.4 ${y + 3.2} 4.6 ${y + 3} Q 5.5 ${y + 2.6} 5.4 ${y + 0.8} Z` }, paint(C.tongue, C.feature)],
      [{ kind: 'path', d: `M 1.5 ${y} Q 4 ${y + 1.8} 6.5 ${y - 0.5}` }, ink(C.feature)],
    ],
    neutral: [[{ kind: 'path', d: `M 2 ${y + 0.4} H 6.3` }, ink(C.feature)]],
    sad: [[{ kind: 'path', d: `M 1.8 ${y + 1.2} Q 4 ${y - 0.8} 6.4 ${y + 1}` }, ink(C.feature)]],
  };
  return { pieces: [{ bone: 'head', layer: 'mouth', views: FRONT, shapes: shapes[style] }] };
}

/** Wearable id → art. Ids are what the catalog's `wearable` field points at. */
const STARTER: Record<string, Wearable> = {
  'body': body(),
  ...Object.fromEntries(Object.entries(FACE_SHAPES).map(([s, d]) => [`face-${s}`, face(d)])),
  'eyes-1': eyes('dots'),
  'eyes-2': eyes('open'),
  'nose-normal': nose('normal'),
  'nose-round': nose('round'),
  'mouth-happy': mouth('happy'),
  'mouth-angry': mouth('angry'),
  'hair-center-parted': hair('parted', C.hairDark, C.hairDarkLine),
  'hair-puffed': hair('puffed', C.hairRed, C.hairRedLine),
  'hair-spiked': hair('spiked', C.hairBlond, C.hairBlondLine),
  't-shirt': celTee(),
  'denim-jacket': top('long', C.denim, C.denimLine),
  'jeans': celJeans(),
  'cargo': trousers(C.cargo, C.cargoLine, true),

  ...Object.fromEntries((['sleepy', 'wide', 'wink', 'lashes', 'happy', 'star', 'cat', 'heart'] as const).map(s => [`eyes-${s}`, moreEyes(s)])),
  ...Object.fromEntries((['button', 'pointed', 'freckled', 'wide'] as const).map(s => [`nose-${s}`, moreNoses(s)])),
  ...Object.fromEntries((['smirk', 'grin', 'surprised', 'tongue', 'neutral', 'sad'] as const).map(s => [`mouth-${s}`, moreMouths(s)])),
  ...Object.fromEntries([
    'buzz', 'fade', 'side-part', 'quiff', 'pixie', 'bob', 'long', 'waves',
    'ponytail', 'man-bun', 'space-buns', 'afro', 'curly', 'braids', 'mohawk',
  ].map(s => [`hair-${s}`, hairStyle(s)])),
  ...Object.fromEntries((['stubble', 'full', 'goatee', 'moustache', 'handlebar', 'chops'] as const).map(s => [`facial-hair-${s}`, facialHair(s)])),
  ...Object.fromEntries((['cap', 'cap-back', 'beanie', 'bucket', 'headphones', 'crown', 'cowboy', 'beret'] as const).map(s => [`headwear-${s}`, headwear(s)])),
  ...Object.fromEntries((['round', 'sunglasses', 'aviators', 'patch', 'mask', 'monocle'] as const).map(s => [`facewear-${s}`, facewear(s)])),
  ...Object.fromEntries((['watch', 'smartwatch', 'bracelet', 'sweatband', 'beads'] as const).map(s => [`wrist-${s}`, wristwear(s)])),
  ...Object.fromEntries((['necklace', 'pendant', 'scarf'] as const).map(s => [`neck-${s}`, neckwear(s)])),
  ...Object.fromEntries((['sneakers', 'high-tops', 'boots', 'sandals', 'slides', 'dress'] as const).map(s => [`shoes-${s}`, footwear(s)])),
  ...Object.fromEntries((['hoodie', 'tank', 'polo', 'sweater', 'button-up', 'blazer', 'jersey', 'track-jacket', 'puffer', 'crop', 'long-coat'] as const).map(s => [`top-${s}`, tintedTop(s)])),
  ...Object.fromEntries((['shorts', 'cargo-shorts', 'joggers', 'chinos', 'track-pants', 'ripped', 'skirt', 'leggings'] as const).map(s => [`bottoms-${s}`, tintedBottoms(s)])),
};

function pieceSvg(piece: Piece, view: RigView): string {
  const o = frameOrigins(view, 'east')[piece.bone];
  const shapes = piece.shapes.map(([shape, attrs]) => shapeSvg(shape, attrs)).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_PX_W}" height="${FRAME_PX_H}" viewBox="0 0 ${FRAME_PX_W} ${FRAME_PX_H}">`,
    `<g transform="translate(${o.x} ${o.y}) scale(${S})">${shapes}</g>`,
    '</svg>',
    '',
  ].join('\n');
}

for (const [id, wearable] of Object.entries(STARTER)) {
  const dir = join(ART_DIR, id);
  rmSync(dir, { recursive: true, force: true });
  for (const piece of wearable.pieces) {
    for (const view of piece.views) {
      mkdirSync(join(dir, view), { recursive: true });
      const band = piece.band && piece.band !== 'body' ? `.${piece.band}` : '';
      writeFileSync(join(dir, view, `${piece.bone}.${piece.layer}${band}.svg`), pieceSvg(piece, view));
    }
  }
  writeFileSync(join(dir, 'asset.json'), JSON.stringify({ tintable: wearable.tintable ?? false }, null, 2) + '\n');
  console.log(`wrote ${id} (${wearable.pieces.length} pieces)`);
}
