import { BlendMode, Skia, type SkColor, type SkImage } from '@shopify/react-native-skia';

import {
  HUMANOID_V1,
  WEARABLE_ART_SCALE,
  slotBone,
  type AtlasSprite,
  type Attachment,
  type RigView,
  type SlotName,
  type WearableAsset,
} from '@chat-app/shared-types';
import type { AvatarArt, ViewDrawList } from '../skeleton/avatarArt';
import { BONE_INDEX } from '../skeleton/humanoidV1';

/** One equipped wearable: its packed art, decoded atlas and the colours its tintable pieces take. */
export interface WornPart {
  asset: WearableAsset;
  image: SkImage;
  /** For tintable pieces on the skin and face layers. */
  skinTint: SkColor;
  /** For other tintable pieces: the variant's colour, or null to leave them as drawn. */
  colorTint: SkColor | null;
}

const VIEWS: RigView[] = ['front', 'back'];
/** Transparent gap between sprites so linear sampling doesn't bleed neighbours in. */
const GAP = 2;
const MAX_WIDTH = 512;

const SKIN_LAYERS = new Set(['skin', 'face']);

function tintFor(part: WornPart, att: Attachment): SkColor | null {
  if (!att.tintable) return null;
  return SKIN_LAYERS.has(att.slot.slice(att.slot.lastIndexOf('/') + 1)) ? part.skinTint : part.colorTint;
}

interface Entry {
  view: RigView;
  slot: SlotName;
  part: WornPart;
  att: Attachment;
  /** Composed-atlas pixels per source-atlas pixel. */
  k: number;
  w: number;
  h: number;
  /** Top-left of the east sprite; the west sprite sits to its right. */
  x: number;
  y: number;
}

/**
 * Bakes an avatar's worn pieces into one atlas, tinted and in rig draw order, so the
 * frame loop still draws each avatar with a single drawAtlas call. Runs on the JS
 * thread once per distinct outfit.
 */
export function composeAvatar(parts: WornPart[]): AvatarArt {
  const entries: Entry[] = [];
  for (const view of VIEWS) {
    for (const slot of HUMANOID_V1.drawOrder[view]) {
      for (const part of parts) {
        const att = part.asset.views[view].find(a => a.slot === slot);
        if (!att) continue;
        const k = WEARABLE_ART_SCALE / part.asset.scale;
        const w = Math.ceil(Math.max(att.east.region.w, att.west.region.w) * k);
        const h = Math.ceil(Math.max(att.east.region.h, att.west.region.h) * k);
        entries.push({ view, slot, part, att, k, w, h, x: 0, y: 0 });
      }
    }
  }

  // Shelf layout: each entry takes a cell two sprites wide (east, then west).
  let x = GAP, y = GAP, shelfH = 0, width = 0;
  for (const e of entries) {
    const cellW = 2 * e.w + GAP;
    if (x + cellW + GAP > MAX_WIDTH && x > GAP) {
      x = GAP;
      y += shelfH + GAP;
      shelfH = 0;
    }
    e.x = x;
    e.y = y;
    x += cellW + GAP;
    shelfH = Math.max(shelfH, e.h);
    width = Math.max(width, x);
  }
  const height = y + shelfH + GAP;

  const surface = Skia.Surface.Make(Math.max(1, width), Math.max(1, height));
  if (!surface) throw new Error('Could not create an avatar atlas surface');
  const canvas = surface.getCanvas();

  const empty = (): ViewDrawList => ({ bone: [], tint: [], src: [], srcMirror: [], pivotX: [], pivotXMirror: [], pivotY: [], pivotYMirror: [] });
  const views: Record<RigView, ViewDrawList> = { front: empty(), back: empty() };

  const draw = (e: Entry, sprite: AtlasSprite, left: number, paint: ReturnType<typeof Skia.Paint>) => {
    const { region } = sprite;
    canvas.drawImageRect(
      e.part.image,
      Skia.XYWHRect(region.x, region.y, region.w, region.h),
      Skia.XYWHRect(left, e.y, region.w * e.k, region.h * e.k),
      paint,
    );
  };

  for (const e of entries) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const tint = tintFor(e.part, e.att);
    if (tint) paint.setColorFilter(Skia.ColorFilter.MakeBlend(tint, BlendMode.Modulate));
    const westX = e.x + e.w + GAP;
    draw(e, e.att.east, e.x, paint);
    draw(e, e.att.west, westX, paint);

    const list = views[e.view];
    list.bone.push(BONE_INDEX[slotBone(e.slot)]);
    list.tint.push('skin');
    list.src.push(Skia.XYWHRect(e.x, e.y, e.att.east.region.w * e.k, e.att.east.region.h * e.k));
    list.srcMirror.push(Skia.XYWHRect(westX, e.y, e.att.west.region.w * e.k, e.att.west.region.h * e.k));
    // Pivots are relative to their own rect: east pairs with src, west with srcMirror.
    list.pivotX.push(e.att.east.pivot.x * e.k);
    list.pivotXMirror.push(e.att.west.pivot.x * e.k);
    list.pivotY.push(e.att.east.pivot.y * e.k);
    list.pivotYMirror.push(e.att.west.pivot.y * e.k);
  }

  const snapshot = surface.makeImageSnapshot();
  // A CPU-backed copy can be drawn from the UI thread's canvas.
  const image = snapshot.makeNonTextureImage() ?? snapshot;
  return { image, scale: WEARABLE_ART_SCALE, tinted: false, views };
}
