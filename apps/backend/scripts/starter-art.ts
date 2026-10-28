/**
 * Generates placeholder wearable art for today's avatar catalog, until real art is
 * drawn on the rig template in Figma.
 *
 *   pnpm --filter @chat-app/backend art:starter && pnpm --filter @chat-app/backend art:pack
 *
 * Writes art/wearables/<id>/ folders in exactly the format an artist would export:
 * one full-frame SVG per piece, named <bone>.<layer>.svg. Colours follow the legacy
 * SVGs so the two engines look alike. Re-running overwrites these folders only.
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WEARABLE_ART_SCALE, type BoneName, type RigView, type SlotLayer } from '@chat-app/shared-types';

import { ART_DIR, FRAME_PX_H, FRAME_PX_W, frameOrigins } from './wearables/frame';
import { HEAD_CY, HEAD_R, bodyShapes, capsule, disc, shapeSvg, type Shape } from './wearables/shapes';

const S = WEARABLE_ART_SCALE;
const OUTLINE = 0.6;

/** Art colours, taken from the legacy catalog SVGs. Art data, not app UI. */
const C = {
  tintBase: '#ffffff',
  tintLine: '#8a8a8a',
  feature: '#2b2b2b',
  eyeWhite: '#ffffff',
  shade: 'rgba(0,0,0,0.22)',
  tshirt: '#82c55f',
  tshirtLine: '#4f8a35',
  denim: '#8c949b',
  denimLine: '#515252',
  jeans: '#365b91',
  jeansLine: '#363c46',
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
};

interface Piece {
  bone: BoneName;
  layer: SlotLayer;
  views: RigView[];
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

function body(): Wearable {
  const pieces: Piece[] = [];
  for (const view of BOTH) {
    for (const [bone, shape] of Object.entries(bodyShapes(view)) as [BoneName, Shape][]) {
      pieces.push({ bone, layer: 'skin', views: [view], shapes: [[shape, paint(C.tintBase, C.tintLine)]] });
    }
  }
  return { tintable: true, pieces };
}

function face(rx: number, ry: number): Wearable {
  const shape: Shape = { kind: 'oval', x: -rx, y: HEAD_CY - ry, w: 2 * rx, h: 2 * ry };
  return {
    tintable: true,
    pieces: [{ bone: 'head', layer: 'face', views: BOTH, shapes: [[shape, paint(C.tintBase, C.tintLine)]] }],
  };
}

/** Features sit right of centre: the front view is turned towards screen right. */
const EYE_Y = HEAD_CY + 1;
const EYES_X = [1.5, 5.5];

function eyes(style: 'dots' | 'open'): Wearable {
  const shapes: Array<[Shape, string]> = EYES_X.flatMap(x => style === 'dots'
    ? [[disc(x, EYE_Y, 1.2), `fill="${C.feature}"`] as [Shape, string]]
    : [
        [{ kind: 'oval', x: x - 1.5, y: EYE_Y - 2, w: 3, h: 4 }, paint(C.eyeWhite, C.feature)] as [Shape, string],
        [disc(x + 0.4, EYE_Y + 0.3, 0.9), `fill="${C.feature}"`] as [Shape, string],
      ]);
  return { pieces: [{ bone: 'head', layer: 'eye', views: FRONT, shapes }] };
}

function nose(style: 'normal' | 'round'): Wearable {
  const shape: Shape = style === 'normal'
    ? { kind: 'path', d: `M 5.5 ${HEAD_CY + 2} L 7 ${HEAD_CY + 4.5} L 5.5 ${HEAD_CY + 4.8}` }
    : disc(6, HEAD_CY + 4, 1.1);
  const attrs = style === 'normal' ? ink(C.feature, 0.5) : `fill="${C.shade}"`;
  return { pieces: [{ bone: 'head', layer: 'nose', views: FRONT, shapes: [[shape, attrs]] }] };
}

function mouth(mood: 'happy' | 'angry'): Wearable {
  const y = HEAD_CY + 6.5;
  const d = mood === 'happy'
    ? `M 1.5 ${y} Q 4 ${y + 2.2} 6.5 ${y - 0.5}`
    : `M 1.5 ${y + 1} Q 4 ${y - 1} 6.5 ${y + 0.8}`;
  const shapes: Array<[Shape, string]> = [[{ kind: 'path', d }, ink(C.feature)]];
  if (mood === 'angry') {
    shapes.push([{ kind: 'path', d: `M 0 ${EYE_Y - 3.5} L 3 ${EYE_Y - 2.2} M 7 ${EYE_Y - 2.2} L 9 ${EYE_Y - 3.5}` }, ink(C.feature, 0.7)]);
  }
  return { pieces: [{ bone: 'head', layer: 'mouth', views: FRONT, shapes }] };
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

/** A full circle as a path, so it can share an evenodd fill with a cut-out. */
function circleD(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

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

/** Hair styles, all tintable: the catalog gives each one a set of hair colours. */
function hairStyle(style: string): Wearable {
  const head = circleD(0, CY, R);
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
    case 'long':
      return headPieces('hair', [hairMass(longFront, CY - 4)], tinted({ kind: 'path', d: longBack }));
    case 'waves':
      return headPieces('hair',
        [hairMass(
          `M ${R + 1} ${CY} A ${R + 1} ${R + 1} 0 0 0 ${-(R + 1)} ${CY} Q ${-(R + 3)} ${CY + 6} ${-(R + 1)} ${CY + 12} ` +
          `Q ${-(R - 1)} ${CY + 18} ${-(R + 2)} ${CY + 24} Q -6 ${CY + 27} -2 ${CY + 23} Q -3 ${CY + 15} -1 ${CY + 8} L ${R + 1} ${CY + 6} Z`,
          CY - 4)],
        tinted({
          kind: 'path',
          d: `M ${-(R + 1)} ${CY} A ${R + 1} ${R + 1} 0 0 1 ${R + 1} ${CY} Q ${R + 3} ${CY + 6} ${R + 1} ${CY + 12} ` +
            `Q ${R - 1} ${CY + 18} ${R + 2} ${CY + 24} Q 0 ${CY + 28} ${-(R + 2)} ${CY + 24} ` +
            `Q ${-(R - 1)} ${CY + 18} ${-(R + 1)} ${CY + 12} Q ${-(R + 3)} ${CY + 6} ${-(R + 1)} ${CY} Z`,
        }));
    case 'ponytail':
      return headPieces('hair', [
        hairMass(head, CY - 5),
        [{ kind: 'path', d: `M ${-R + 1} ${CY - 5} Q ${-R - 6} ${CY - 2} ${-R - 3} ${CY + 16} Q ${-R - 1} ${CY + 18} ${-R} ${CY + 15} Q ${-R - 2} ${CY + 2} ${-R + 3} ${CY - 2} Z` }, TINT],
      ], tinted(hairBack(4), roundRect(-2.5, CY + 2, 5, 16, 2.5)));
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
      return headPieces('hair', [hairMass(head, CY - 5), [roundRect(-R - 1.5, CY, 4, 20, 2), TINT]],
        tinted(hairBack(4), roundRect(-6, CY + 2, 4, 18, 2), roundRect(2, CY + 2, 4, 18, 2)));
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

function footwear(style: 'sneakers' | 'high-tops' | 'boots' | 'sandals' | 'slides' | 'dress'): Wearable {
  const shoe: Shape = { kind: 'path', d: 'M -3.6 -2.6 L 2.5 -2.6 Q 7.5 -1.2 8 2 L 8 3.4 L -3.8 3.4 Z' };
  const sole = roundRect(-3.9, 2.4, 12, 1.4, 0.6);
  const lowShoe: Shape = { kind: 'path', d: 'M -3.4 -1.2 L 2.5 -1.6 Q 7.8 -0.5 8.2 2.2 L 8.2 3.2 L -3.6 3.2 Z' };
  const feet: Record<typeof style, Array<[Shape, string]>> = {
    'sneakers': [[shoe, TINT], [sole, `fill="${C.eyeWhite}" stroke="${C.tintLine}" stroke-width="0.4"`]],
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

type TopStyle = 'hoodie' | 'tank' | 'polo' | 'sweater' | 'button-up' | 'blazer' | 'jersey' | 'track-jacket' | 'puffer' | 'crop';

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
    pieces[0].shapes.push([{ kind: 'path', d: 'M -7 -3 L 7 -3 L 10.5 15 Q 0 17 -10.5 15 Z' }, TINT]);
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

function faceShape(style: 'oval' | 'long' | 'square' | 'heart'): Wearable {
  const shapes: Record<typeof style, Shape> = {
    oval: { kind: 'oval', x: -(HEAD_R - 0.6), y: CY - (HEAD_R + 0.6), w: 2 * (HEAD_R - 0.6), h: 2 * (HEAD_R + 0.6) },
    long: { kind: 'oval', x: -(HEAD_R - 1.2), y: CY - (HEAD_R + 1.3), w: 2 * (HEAD_R - 1.2), h: 2 * (HEAD_R + 1.3) },
    square: roundRect(-HEAD_R, CY - HEAD_R, 2 * HEAD_R, 2 * HEAD_R, 4),
    heart: { kind: 'path', d: `M -9.3 ${CY - 3} A 9.3 8 0 0 1 9.3 ${CY - 3} Q 9 ${CY + 5} 0 ${CY + 10} Q -9 ${CY + 5} -9.3 ${CY - 3} Z` },
  };
  return { tintable: true, pieces: [{ bone: 'head', layer: 'face', views: BOTH, shapes: [[shapes[style], paint(C.tintBase, C.tintLine)]] }] };
}

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
  'face-normal': face(HEAD_R, HEAD_R),
  'face-round': face(HEAD_R + 1, HEAD_R + 0.3),
  'eyes-1': eyes('dots'),
  'eyes-2': eyes('open'),
  'nose-normal': nose('normal'),
  'nose-round': nose('round'),
  'mouth-happy': mouth('happy'),
  'mouth-angry': mouth('angry'),
  'hair-center-parted': hair('parted', C.hairDark, C.hairDarkLine),
  'hair-puffed': hair('puffed', C.hairRed, C.hairRedLine),
  'hair-spiked': hair('spiked', C.hairBlond, C.hairBlondLine),
  't-shirt': top('short', C.tshirt, C.tshirtLine),
  'denim-jacket': top('long', C.denim, C.denimLine),
  'jeans': trousers(C.jeans, C.jeansLine, false),
  'cargo': trousers(C.cargo, C.cargoLine, true),

  ...Object.fromEntries((['oval', 'long', 'square', 'heart'] as const).map(s => [`face-${s}`, faceShape(s)])),
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
  ...Object.fromEntries((['sneakers', 'high-tops', 'boots', 'sandals', 'slides', 'dress'] as const).map(s => [`shoes-${s}`, footwear(s)])),
  ...Object.fromEntries((['hoodie', 'tank', 'polo', 'sweater', 'button-up', 'blazer', 'jersey', 'track-jacket', 'puffer', 'crop'] as const).map(s => [`top-${s}`, tintedTop(s)])),
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
      writeFileSync(join(dir, view, `${piece.bone}.${piece.layer}.svg`), pieceSvg(piece, view));
    }
  }
  writeFileSync(join(dir, 'asset.json'), JSON.stringify({ tintable: wearable.tintable ?? false }, null, 2) + '\n');
  console.log(`wrote ${id} (${wearable.pieces.length} pieces)`);
}
