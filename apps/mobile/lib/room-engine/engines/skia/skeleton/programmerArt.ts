import { PaintStyle, Skia, type SkCanvas, type SkImage, type SkRect } from '@shopify/react-native-skia';

import { palette } from '@/constants/theme';
import type { RigView, SlotName } from '@chat-app/shared-types';
import { BONE_INDEX, HUMANOID_V1 } from './humanoidV1';

/**
 * Programmer art for the Phase 2 test avatar: one simple shape per bone, drawn white
 * with a grey outline into a small atlas, then tinted per avatar by drawAtlas colours.
 * Phase 3 replaces this with packed wearable atlases in the same draw format.
 */

/** Atlas pixels per content pixel. 3x stays sharp at 1.5x zoom on a 2x screen. */
export const ART_SCALE = 3;
const PAD = 2;
const OUTLINE = 0.6;

/** Which avatar colour tints a piece. */
export type TintGroup = 'skin' | 'tops' | 'bottoms' | 'footwear' | 'hair';
export const TINT_GROUPS: TintGroup[] = ['skin', 'tops', 'bottoms', 'footwear', 'hair'];

interface Piece {
  /** Bounds in bone-local content pixels; the bone origin is (0, 0). */
  bounds: [minX: number, minY: number, maxX: number, maxY: number];
  tint: TintGroup;
  draw(canvas: SkCanvas, fill: ReturnType<typeof Skia.Paint>, stroke: ReturnType<typeof Skia.Paint>): void;
}

/** A rounded limb segment along local y, from y0 to y1, `w` wide. */
function capsule(w: number, y0: number, y1: number, tint: TintGroup): Piece {
  return {
    bounds: [-w / 2, y0, w / 2, y1],
    tint,
    draw(canvas, fill, stroke) {
      const rrect = Skia.RRectXY(Skia.XYWHRect(-w / 2, y0, w, y1 - y0), w / 2, w / 2);
      canvas.drawRRect(rrect, fill);
      canvas.drawRRect(rrect, stroke);
    },
  };
}

function disc(cx: number, cy: number, r: number, tint: TintGroup): Piece {
  return {
    bounds: [cx - r, cy - r, cx + r, cy + r],
    tint,
    draw(canvas, fill, stroke) {
      canvas.drawCircle(cx, cy, r, fill);
      canvas.drawCircle(cx, cy, r, stroke);
    },
  };
}

const HEAD_R = 9;
const HEAD_CY = -8;

/** Front head turned to screen right: eyes sit right of centre. */
const HEAD_FRONT: Piece = {
  bounds: [-HEAD_R, HEAD_CY - HEAD_R, HEAD_R, HEAD_CY + HEAD_R],
  tint: 'skin',
  draw(canvas, fill, stroke) {
    canvas.drawCircle(0, HEAD_CY, HEAD_R, fill);
    canvas.drawCircle(0, HEAD_CY, HEAD_R, stroke);
    const eye = Skia.Paint();
    eye.setAntiAlias(true);
    eye.setColor(Skia.Color(palette.black));
    canvas.drawCircle(1.5, HEAD_CY + 1, 1.2, eye);
    canvas.drawCircle(5.5, HEAD_CY + 1, 1.2, eye);
  },
};

/** Hair cap over the top of the head, with a fringe that leaves the face clear. */
const HAIR_FRONT: Piece = {
  bounds: [-HEAD_R - 0.5, HEAD_CY - HEAD_R - 1, HEAD_R + 0.5, HEAD_CY - 1],
  tint: 'hair',
  draw(canvas, fill, stroke) {
    const path = Skia.PathBuilder.Make()
      .addArc(Skia.XYWHRect(-HEAD_R - 0.5, HEAD_CY - HEAD_R - 1, 2 * HEAD_R + 1, 2 * HEAD_R + 1), 180, 180)
      .lineTo(HEAD_R + 0.5, HEAD_CY - 1)
      .lineTo(-HEAD_R + 2, HEAD_CY - 3)
      .close()
      .build();
    canvas.drawPath(path, fill);
    canvas.drawPath(path, stroke);
  },
};

const HEAD_BACK: Piece = disc(0, HEAD_CY, HEAD_R, 'skin');

/** Seen from behind, hair covers all but the nape. */
const HAIR_BACK: Piece = {
  bounds: [-HEAD_R - 0.5, HEAD_CY - HEAD_R - 1, HEAD_R + 0.5, HEAD_CY + HEAD_R - 3],
  tint: 'hair',
  draw(canvas, fill, stroke) {
    const path = Skia.PathBuilder.Make()
      .addArc(Skia.XYWHRect(-HEAD_R - 0.5, HEAD_CY - HEAD_R - 1, 2 * HEAD_R + 1, 2 * HEAD_R + 1), 150, 240)
      .close()
      .build();
    canvas.drawPath(path, fill);
    canvas.drawPath(path, stroke);
  },
};

/** Feet point forward (screen right). */
const FOOT: Piece = {
  bounds: [-3, -2, 8, 3.5],
  tint: 'footwear',
  draw(canvas, fill, stroke) {
    const rect = Skia.XYWHRect(-3, -2, 11, 5.5);
    canvas.drawOval(rect, fill);
    canvas.drawOval(rect, stroke);
  },
};

const LIMBS: Partial<Record<SlotName, Piece>> = {
  'spine/tops': capsule(14, -11, 4, 'tops'),
  'chest/tops': capsule(16, -16, 2, 'tops'),
  'neck/skin': capsule(5, -5, 1, 'skin'),
  'upperArm.L/tops': capsule(6, -2, 13, 'tops'),
  'foreArm.L/tops': capsule(5, -1, 12, 'tops'),
  'hand.L/skin': disc(0, 2, 3, 'skin'),
  'upperArm.R/tops': capsule(6, -2, 13, 'tops'),
  'foreArm.R/tops': capsule(5, -1, 12, 'tops'),
  'hand.R/skin': disc(0, 2, 3, 'skin'),
  'thigh.L/bottoms': capsule(8, -3, 18, 'bottoms'),
  'shin.L/bottoms': capsule(7, -1, 16, 'bottoms'),
  'foot.L/footwear': FOOT,
  'thigh.R/bottoms': capsule(8, -3, 18, 'bottoms'),
  'shin.R/bottoms': capsule(7, -1, 16, 'bottoms'),
  'foot.R/footwear': FOOT,
};

const PIECES: Record<RigView, Partial<Record<SlotName, Piece>>> = {
  front: { ...LIMBS, 'head/skin': HEAD_FRONT, 'head/hair': HAIR_FRONT },
  back: { ...LIMBS, 'head/skin': HEAD_BACK, 'head/hair': HAIR_BACK },
};

/**
 * What the UI thread needs to draw one view, in draw order. `mirror` holds the
 * horizontally flipped sprites for the west-facing pair (RSXform can't flip).
 */
export interface ViewDrawList {
  bone: number[];
  tint: TintGroup[];
  src: SkRect[];
  srcMirror: SkRect[];
  pivotX: number[];
  pivotXMirror: number[];
  pivotY: number[];
}

export interface AvatarArt {
  image: SkImage;
  views: Record<RigView, ViewDrawList>;
}

function cellSize(piece: Piece) {
  const [minX, minY, maxX, maxY] = piece.bounds;
  return {
    w: Math.ceil((maxX - minX) * ART_SCALE) + 2 * PAD,
    h: Math.ceil((maxY - minY) * ART_SCALE) + 2 * PAD,
  };
}

function buildArt(): AvatarArt {
  // Each piece gets two cells side by side (normal, mirrored), one row per piece.
  const entries = (['front', 'back'] as RigView[]).flatMap(view =>
    HUMANOID_V1.drawOrder[view]
      .filter(slot => PIECES[view][slot])
      .map(slot => ({ view, slot, piece: PIECES[view][slot]! })),
  );
  const cells = entries.map(e => cellSize(e.piece));
  const width = 2 * Math.max(...cells.map(c => c.w));
  const height = cells.reduce((sum, c) => sum + c.h, 0);

  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error('Could not create the avatar atlas surface');
  const canvas = surface.getCanvas();

  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(palette.white));
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(OUTLINE);
  stroke.setColor(Skia.Color(palette.neutral600));

  const empty = (): ViewDrawList => ({ bone: [], tint: [], src: [], srcMirror: [], pivotX: [], pivotXMirror: [], pivotY: [] });
  const views: Record<RigView, ViewDrawList> = { front: empty(), back: empty() };

  let top = 0;
  entries.forEach(({ view, slot, piece }, i) => {
    const { w, h } = cells[i];
    const [minX, minY, maxX] = piece.bounds;
    const pivotX = PAD - minX * ART_SCALE;
    const pivotXMirror = PAD + maxX * ART_SCALE;
    const pivotY = PAD - minY * ART_SCALE;
    const mirrorLeft = width / 2;

    canvas.save();
    canvas.translate(pivotX, top + pivotY);
    canvas.scale(ART_SCALE, ART_SCALE);
    piece.draw(canvas, fill, stroke);
    canvas.restore();

    canvas.save();
    canvas.translate(mirrorLeft + pivotXMirror, top + pivotY);
    canvas.scale(-ART_SCALE, ART_SCALE);
    piece.draw(canvas, fill, stroke);
    canvas.restore();

    const list = views[view];
    list.bone.push(BONE_INDEX[HUMANOID_V1.slots.find(s => s.name === slot)!.bone]);
    list.tint.push(piece.tint);
    list.src.push(Skia.XYWHRect(0, top, w, h));
    list.srcMirror.push(Skia.XYWHRect(mirrorLeft, top, w, h));
    list.pivotX.push(pivotX);
    list.pivotXMirror.push(pivotXMirror);
    list.pivotY.push(pivotY);
    top += h;
  });

  const snapshot = surface.makeImageSnapshot();
  // A CPU-backed copy can be drawn from the UI thread's canvas.
  const image = snapshot.makeNonTextureImage() ?? snapshot;
  return { image, views };
}

let art: AvatarArt | null = null;

/** Built on first use and kept for the app's lifetime. */
export function getAvatarArt(): AvatarArt {
  art ??= buildArt();
  return art;
}
