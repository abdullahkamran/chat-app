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
