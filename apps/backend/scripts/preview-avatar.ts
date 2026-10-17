/**
 * Renders a dressed avatar in the bind pose from packed atlases, in all four facings,
 * to check new art before it ships: pivots, draw order, mirroring and tints.
 *
 *   pnpm --filter @chat-app/backend art:preview out.png body face-normal eyes-1 t-shirt jeans
 *
 * Wearables are given by id (see src/catalog/wearables.generated.json). Tintable
 * pieces use the default skin tone. Reads only what the app reads: the manifest and atlases.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import sharp, { type OverlayOptions } from 'sharp';
import {
  HUMANOID_V1,
  bindOrigins,
  type RigView,
  type WearableAsset,
} from '@chat-app/shared-types';

import { FRAME_PX_H, FRAME_PX_W, ROOT_X, ROOT_Y } from './wearables/frame';

const ROOT = join(__dirname, '..');
const SKIN = { r: 0xff, g: 0xdb, b: 0xb8 };
const BACKDROP = { r: 0x22, g: 0x22, b: 0x22, alpha: 1 };

const [out, ...ids] = process.argv.slice(2);
if (!out || ids.length === 0) {
  console.error('usage: art:preview <out.png> <wearable id>...');
  process.exit(1);
}

const manifest: Record<string, WearableAsset> = JSON.parse(
  readFileSync(join(ROOT, 'src', 'catalog', 'wearables.generated.json'), 'utf8'),
);

async function atlas(asset: WearableAsset) {
  const { data, info } = await sharp(join(ROOT, 'public', asset.atlasUrl))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

async function main() {
  const assets = ids.map(id => {
    const a = manifest[id];
    if (!a) throw new Error(`no wearable "${id}" in the manifest`);
    return a;
  });
  const atlases = await Promise.all(assets.map(atlas));

  const frames: { view: RigView; mirror: boolean }[] = [
    { view: 'front', mirror: false }, { view: 'front', mirror: true },
    { view: 'back', mirror: false }, { view: 'back', mirror: true },
  ];
  const layers: OverlayOptions[] = [];

  frames.forEach(({ view, mirror }, f) => {
    const origins = bindOrigins(view);
    for (const slot of HUMANOID_V1.drawOrder[view]) {
      assets.forEach((asset, a) => {
        const att = asset.views[view].find(x => x.slot === slot);
        if (!att) return;
        const sprite = mirror ? att.west : att.east;
        const bone = origins[slot.slice(0, slot.lastIndexOf('/')) as keyof typeof origins];
        const s = asset.scale;
        const { region, pivot } = sprite;

        const px = Buffer.alloc(region.w * region.h * 4);
        const src = atlases[a];
        for (let y = 0; y < region.h; y++) {
          for (let x = 0; x < region.w; x++) {
            const i = ((region.y + y) * src.width + region.x + x) * 4;
            const o = (y * region.w + x) * 4;
            const tint = att.tintable ? SKIN : { r: 255, g: 255, b: 255 };
            px[o] = (src.data[i] * tint.r) / 255;
            px[o + 1] = (src.data[i + 1] * tint.g) / 255;
            px[o + 2] = (src.data[i + 2] * tint.b) / 255;
            px[o + 3] = src.data[i + 3];
          }
        }
        const boneX = (ROOT_X + (mirror ? -bone.x : bone.x)) * s;
        layers.push({
          input: px,
          raw: { width: region.w, height: region.h, channels: 4 },
          left: Math.round(f * FRAME_PX_W + boneX - pivot.x),
          top: Math.round((ROOT_Y + bone.y) * s - pivot.y),
        });
      });
    }
  });

  await sharp({ create: { width: FRAME_PX_W * frames.length, height: FRAME_PX_H, channels: 4, background: BACKDROP } })
    .composite(layers)
    .png()
    .toFile(out);
  console.log(`wrote ${out}: SE, SW, NE, NW`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
