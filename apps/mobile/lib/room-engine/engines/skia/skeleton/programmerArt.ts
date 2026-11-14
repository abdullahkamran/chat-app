import { Skia, type SkCanvas } from '@shopify/react-native-skia';

import { artPalette } from '@/constants/theme';
import type { RigView, SlotName } from '@chat-app/shared-types';
import type { AvatarArt, ViewDrawList } from './avatarArt';
import { BONE_INDEX, HUMANOID_V1 } from './humanoidV1';

/**
 * The loading ghost: a plain silhouette of the rig, one rounded shape per bone with no
 * face, hair, clothes or outlines. It's drawn white into a small atlas and tinted at draw
 * time with the pulsing ghost colour (see avatarGhost.ts), so it reads as a skeleton
 * placeholder, not as somebody's avatar. Shown while an outfit's atlases load and compose
 * (dressed avatars use packed wearable atlases in the same draw format, see wearables/),
 * and for the dev stress avatars, which have no outfit.
 */

/** Atlas pixels per content pixel. 3x stays sharp at 1.5x zoom on a 2x screen. */
export const ART_SCALE = 3;
const PAD = 2;

interface Piece {
  /** Bounds in bone-local content pixels; the bone origin is (0, 0). */
  bounds: [minX: number, minY: number, maxX: number, maxY: number];
  draw(canvas: SkCanvas, fill: ReturnType<typeof Skia.Paint>): void;
}

/** A rounded limb segment along local y, from y0 to y1, `w` wide. */
function capsule(w: number, y0: number, y1: number): Piece {
  return {
    bounds: [-w / 2, y0, w / 2, y1],
    draw(canvas, fill) {
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-w / 2, y0, w, y1 - y0), w / 2, w / 2), fill);
    },
  };
}

function disc(cx: number, cy: number, r: number): Piece {
  return {
    bounds: [cx - r, cy - r, cx + r, cy + r],
    draw(canvas, fill) {
      canvas.drawCircle(cx, cy, r, fill);
    },
  };
}

/** The skull: a third of the avatar's height, centred above the head bone's origin. */
const HEAD_R = 12.6;
const HEAD_CY = -11.2;

/** Feet point forward (screen right). */
const FOOT: Piece = {
  bounds: [-3, -2, 8, 3.5],
  draw(canvas, fill) {
    canvas.drawOval(Skia.XYWHRect(-3, -2, 11, 5.5), fill);
  },
};

/** The same from the front and the back: a silhouette has no face to turn. */
const PIECES: Partial<Record<SlotName, Piece>> = {
  'hip/skin': capsule(13.5, -3, 3.5),
  'spine/skin': capsule(13.5, -9, 3.5),
  'chest/skin': capsule(14.5, -11.5, 2),
  'neck/skin': capsule(5, -7, 1),
  'head/skin': disc(0, HEAD_CY, HEAD_R),
  'upperArm.L/skin': capsule(5.4, -2.7, 10.5),
  'foreArm.L/skin': capsule(4.6, -1.5, 9.5),
  'hand.L/skin': disc(0, 2, 2.8),
  'upperArm.R/skin': capsule(5.4, -2.7, 10.5),
  'foreArm.R/skin': capsule(4.6, -1.5, 9.5),
  'hand.R/skin': disc(0, 2, 2.8),
  'thigh.L/skin': capsule(7.2, -3.6, 17),
  'shin.L/skin': capsule(6.2, -2, 15),
  'foot.L/skin': FOOT,
  'thigh.R/skin': capsule(7.2, -3.6, 17),
  'shin.R/skin': capsule(6.2, -2, 15),
  'foot.R/skin': FOOT,
};

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
      .filter(slot => PIECES[slot])
      .map(slot => ({ view, slot, piece: PIECES[slot]! })),
  );
  const cells = entries.map(e => cellSize(e.piece));
  const width = 2 * Math.max(...cells.map(c => c.w));
  const height = cells.reduce((sum, c) => sum + c.h, 0);

  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error('Could not create the avatar atlas surface');
  const canvas = surface.getCanvas();

  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(artPalette.pieceFill));

  const empty = (): ViewDrawList => ({ bone: [], src: [], srcMirror: [], pivotX: [], pivotXMirror: [], pivotY: [], pivotYMirror: [] });
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
    piece.draw(canvas, fill);
    canvas.restore();

    canvas.save();
    canvas.translate(mirrorLeft + pivotXMirror, top + pivotY);
    canvas.scale(-ART_SCALE, ART_SCALE);
    piece.draw(canvas, fill);
    canvas.restore();

    const list = views[view];
    list.bone.push(BONE_INDEX[HUMANOID_V1.slots.find(s => s.name === slot)!.bone]);
    list.src.push(Skia.XYWHRect(0, top, w, h));
    list.srcMirror.push(Skia.XYWHRect(mirrorLeft, top, w, h));
    list.pivotX.push(pivotX);
    list.pivotXMirror.push(pivotXMirror);
    list.pivotY.push(pivotY);
    list.pivotYMirror.push(pivotY);
    top += h;
  });

  const snapshot = surface.makeImageSnapshot();
  // A CPU-backed copy can be drawn from the UI thread's canvas.
  const image = snapshot.makeNonTextureImage() ?? snapshot;
  return { image, scale: ART_SCALE, ghost: true, views };
}

let art: AvatarArt | null = null;

/** Built on first use and kept for the app's lifetime. */
export function getAvatarArt(): AvatarArt {
  art ??= buildArt();
  return art;
}
