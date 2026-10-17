import { join } from 'path';
import { WEARABLE_ART_SCALE, bindOrigins, type BoneName, type RigView } from '@chat-app/shared-types';

/**
 * The template frame every wearable piece is drawn and exported in. Artists export each
 * piece as its own image at exactly this size, so the packer knows where every bone
 * origin sits without per-piece pivots.
 *
 * Content pixels (zoom 1). The root (ground point between the feet) is centred
 * horizontally, so a west-facing frame is the same frame mirrored.
 */
export const FRAME_W = 64;
export const FRAME_H = 96;
export const ROOT_X = FRAME_W / 2;
export const ROOT_Y = 88;

/** Export size in pixels: the frame at the wearable art scale. */
export const FRAME_PX_W = FRAME_W * WEARABLE_ART_SCALE;
export const FRAME_PX_H = FRAME_H * WEARABLE_ART_SCALE;

/** East art faces screen right as drawn; west art is drawn on the mirrored frame. */
export type Side = 'east' | 'west';

/** Bone origins in frame pixels (at WEARABLE_ART_SCALE) for one view and side. */
export function frameOrigins(view: RigView, side: Side): Record<BoneName, { x: number; y: number }> {
  const sign = side === 'west' ? -1 : 1;
  const content = bindOrigins(view);
  const out = {} as Record<BoneName, { x: number; y: number }>;
  for (const [bone, p] of Object.entries(content) as [BoneName, { x: number; y: number }][]) {
    out[bone] = {
      x: (ROOT_X + sign * p.x) * WEARABLE_ART_SCALE,
      y: (ROOT_Y + p.y) * WEARABLE_ART_SCALE,
    };
  }
  return out;
}

/** Wearable source art, one folder per wearable id. */
export const ART_DIR = join(__dirname, '..', '..', 'art', 'wearables');
