/**
 * Packs wearable art into one atlas per wearable and writes its WearableAsset.
 *
 *   pnpm --filter @chat-app/backend art:pack            # every wearable
 *   pnpm --filter @chat-app/backend art:pack jeans-blue # just these
 *
 * Input, per wearable, in art/wearables/<id>/ (see art/README.md):
 *   asset.json             { "mirrorable"?: boolean, "tintable"?: boolean }
 *   front/<bone>.<layer>.(png|svg)   pieces exported at the full template frame size
 *   back/<bone>.<layer>.(png|svg)
 *   front-west/, back-west/          own west art, only when mirrorable is false
 *
 * Output: public/wearables/<id>.png and its entry in src/catalog/wearables.generated.json.
 * Pieces are trimmed to their opaque pixels; the pivot comes from where the rig template
 * puts the bone, so artists never place pivots by hand.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import sharp from 'sharp';
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

import { ART_DIR, FRAME_PX_H, FRAME_PX_W, frameOrigins, type Side } from './wearables/frame';

const ROOT = join(__dirname, '..');

const ATLAS_DIR = join(ROOT, 'public', 'wearables');
const MANIFEST = join(ROOT, 'src', 'catalog', 'wearables.generated.json');

const VIEWS: RigView[] = ['front', 'back'];
const SLOTS = new Set<string>(HUMANOID_V1.slots.map(s => s.name));
/** Transparent gap around each sprite so linear sampling doesn't bleed neighbours in. */
const GAP = 2;
const MAX_ATLAS_W = 1024;
const MAX_ATLAS_SIDE = 2048;
const ALPHA_MIN = 1;

interface AssetConfig {
  mirrorable?: boolean;
  tintable?: boolean;
}

/** A trimmed piece: its pixels and the bone origin inside them. */
interface Sprite {
  data: Buffer;
  w: number;
  h: number;
  pivot: { x: number; y: number };
}

/** Rasterises one exported piece at frame size and trims it to its opaque bounds. */
async function loadPiece(file: string, slot: SlotName, view: RigView, side: Side): Promise<Sprite | null> {
  const input = extname(file) === '.svg' ? sharp(file, { density: 72 * 4 }) : sharp(file);
  const meta = await input.metadata();
  if (meta.width && meta.height && Math.abs(meta.width / meta.height - FRAME_PX_W / FRAME_PX_H) > 0.01) {
    throw new Error(`${file}: not exported at the template frame's aspect (${FRAME_PX_W}x${FRAME_PX_H})`);
  }
  const { data, info } = await input
    .resize(FRAME_PX_W, FRAME_PX_H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] >= ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    console.warn(`  ${file}: empty, skipped`);
    return null;
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cropped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: minX, top: minY, width: w, height: h })
    .raw()
    .toBuffer();
  const origin = frameOrigins(view, side)[slotBone(slot)];
  return { data: cropped, w, h, pivot: { x: origin.x - minX, y: origin.y - minY } };
}

/** The same sprite flipped horizontally, for the mirrored facings. */
async function flipped(sprite: Sprite): Promise<Sprite> {
  const data = await sharp(sprite.data, { raw: { width: sprite.w, height: sprite.h, channels: 4 } })
    .flop()
    .raw()
    .toBuffer();
  return { ...sprite, data, pivot: { x: sprite.w - sprite.pivot.x, y: sprite.pivot.y } };
}

/** Pieces in one folder, keyed by slot. File names are `<bone>.<layer>`, e.g. `shin.L.bottoms.png`. */
async function loadFolder(dir: string, view: RigView, side: Side): Promise<Map<SlotName, Sprite>> {
  const out = new Map<SlotName, Sprite>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const ext = extname(name);
    if (ext !== '.png' && ext !== '.svg') continue;
    const base = name.slice(0, -ext.length);
    const dot = base.lastIndexOf('.');
    const slot = `${base.slice(0, dot)}/${base.slice(dot + 1)}` as SlotName;
    if (dot < 0 || !SLOTS.has(slot)) throw new Error(`${join(dir, name)}: no humanoid-v1 slot "${slot}"`);
    const sprite = await loadPiece(join(dir, name), slot, view, side);
    if (sprite) out.set(slot, sprite);
  }
  return out;
}

/** Shelf packing, tallest first. Returns each sprite's top-left and the atlas size. */
function pack(sizes: { w: number; h: number }[]) {
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h);
  const widest = Math.max(...sizes.map(s => s.w)) + GAP * 2;
  const total = sizes.reduce((sum, s) => sum + (s.w + GAP) * (s.h + GAP), 0);
  const shelfW = Math.min(MAX_ATLAS_W, Math.max(widest, Math.ceil(Math.sqrt(total) * 1.2)));

  const pos: { x: number; y: number }[] = Array(sizes.length);
  let x = GAP, y = GAP, shelfH = 0, width = 0;
  for (const i of order) {
    const { w, h } = sizes[i];
    if (x + w + GAP > shelfW) {
      x = GAP;
      y += shelfH + GAP;
      shelfH = 0;
    }
    pos[i] = { x, y };
    x += w + GAP;
    shelfH = Math.max(shelfH, h);
    width = Math.max(width, x);
  }
  return { pos, width, height: y + shelfH + GAP };
}

async function packWearable(id: string): Promise<WearableAsset> {
  const dir = join(ART_DIR, id);
  const configFile = join(dir, 'asset.json');
  const config: AssetConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
  const mirrorable = config.mirrorable ?? true;

  // Every sprite in the atlas, in a fixed order, and where each attachment's two sides point.
  const sprites: Sprite[] = [];
  const pieces: Record<RigView, { slot: SlotName; east: number; west: number }[]> = { front: [], back: [] };

  for (const view of VIEWS) {
    const east = await loadFolder(join(dir, view), view, 'east');
    const west = mirrorable ? null : await loadFolder(join(dir, `${view}-west`), view, 'west');
    for (const [slot, sprite] of east) {
      let westSprite: Sprite;
      if (west) {
        const own = west.get(slot);
        if (!own) throw new Error(`${id}: ${view}-west/ has no ${slot}, needed because mirrorable is false`);
        westSprite = own;
      } else {
        westSprite = await flipped(sprite);
      }
      sprites.push(sprite, westSprite);
      pieces[view].push({ slot, east: sprites.length - 2, west: sprites.length - 1 });
    }
  }
  if (sprites.length === 0) throw new Error(`${id}: no pieces found in front/ or back/`);

  const { pos, width, height } = pack(sprites);
  if (width > MAX_ATLAS_SIDE || height > MAX_ATLAS_SIDE) {
    throw new Error(`${id}: atlas is ${width}x${height}, over ${MAX_ATLAS_SIDE}x${MAX_ATLAS_SIDE}`);
  }

  const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(sprites.map((s, i) => ({
      input: s.data,
      raw: { width: s.w, height: s.h, channels: 4 as const },
      left: pos[i].x,
      top: pos[i].y,
    })))
    .png({ compressionLevel: 9 })
    .toBuffer();
  mkdirSync(ATLAS_DIR, { recursive: true });
  writeFileSync(join(ATLAS_DIR, `${id}.png`), png);

  const sprite = (i: number): AtlasSprite => ({
    region: { x: pos[i].x, y: pos[i].y, w: sprites[i].w, h: sprites[i].h },
    pivot: sprites[i].pivot,
  });
  const views = {} as Record<RigView, Attachment[]>;
  for (const view of VIEWS) {
    views[view] = pieces[view].map(p => ({
      slot: p.slot,
      east: sprite(p.east),
      west: sprite(p.west),
      ...(config.tintable ? { tintable: true } : {}),
    }));
  }

  const counts = VIEWS.map(v => `${views[v].length} ${v}`).join(', ');
  console.log(`  ${id}: ${counts} pieces, ${width}x${height} atlas, ${(png.length / 1024).toFixed(1)} KB`);
  return {
    rig: 'humanoid-v1',
    atlasUrl: `/wearables/${id}.png`,
    atlasVersion: parseInt(createHash('sha1').update(png).digest('hex').slice(0, 8), 16),
    scale: WEARABLE_ART_SCALE,
    views,
  };
}

async function main() {
  const requested = process.argv.slice(2);
  const all = existsSync(ART_DIR)
    ? readdirSync(ART_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()
    : [];
  const ids = requested.length ? requested : all;

  const manifest: Record<string, WearableAsset> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : {};
  // A full run drops wearables whose art folder is gone.
  if (!requested.length) for (const id of Object.keys(manifest)) if (!all.includes(id)) delete manifest[id];

  console.log(`Packing ${ids.length} wearable(s)`);
  for (const id of ids) manifest[id] = await packWearable(id);

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} entries to src/catalog/wearables.generated.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
