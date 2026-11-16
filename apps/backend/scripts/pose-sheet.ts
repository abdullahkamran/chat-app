/**
 * Renders an avatar through its animation clips, from the front and from behind, so layering
 * can be checked by eye before it ships: which limb is in front, what a pose hides, how hair,
 * coats and skirts sit while the body moves. One row per clip, frames spread over its length.
 *
 *   pnpm --filter @chat-app/backend art:poses out.png --clips=walk,clap --frames=6 body hair-long top-long-coat jeans
 *
 * Writes `out-front.png` and `out-back.png` (or one of them with `--view=front|back`).
 * `--clips` defaults to every clip; keep it to four or five per sheet or the cells get too
 * small to judge. Wearables are given by id; with none, a plain outfit is used.
 *
 * It poses the source SVGs with the app's own sampler, solver and limb order
 * (apps/mobile/lib/room-engine/engines/skia/skeleton), so what it shows is what the app
 * draws. It also prints how often each clip changes its limb order, and fails if idle or
 * walk change an arm's side: that shows in the app as flickering sleeves.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

import { HUMANOID_V1, drawRank, type BoneName, type DrawBand, type RigView, type SlotName } from '@chat-app/shared-types';

import {
  FAR_ARM_BEHIND,
  NEAR_ARM_BEHIND,
  orderVariantOf,
  orderVariants,
} from '../../mobile/lib/room-engine/engines/skia/skeleton/limbOrder';
import { COMPILED_CLIPS, samplePose, solveWorld } from '../../mobile/lib/room-engine/engines/skia/skeleton/sampler';
import { ART_DIR, FRAME_PX_H, ROOT_Y, frameOrigins } from './wearables/frame';

/** Source art pixels per content pixel. */
const S = 3;
const CELL_W = 96;
const LABEL_W = 110;
const DEFAULT_OUTFIT = ['body', 'face-normal', 'eyes-2', 'nose-normal', 'mouth-happy', 'hair-side-part', 't-shirt', 'jeans', 'shoes-sneakers'];
/** Clips that loop for as long as an avatar stands or walks: an arm must never change sides in them. */
const STEADY = new Set(['idle', 'walk']);
const ARM_BITS = FAR_ARM_BEHIND | NEAR_ARM_BEHIND;

const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [out, ...ids] = args.filter(a => !a.startsWith('--'));
if (!out) {
  console.error('usage: art:poses <out.png> [--view=front|back] [--clips=a,b] [--frames=6] [wearable id]...');
  process.exit(1);
}
const views = (flag('view') ? [flag('view')] : ['front', 'back']) as RigView[];
const clips = flag('clips')?.split(',') ?? Object.keys(COMPILED_CLIPS);
const frames = Number(flag('frames') ?? 6);
const outfit = ids.length ? ids : DEFAULT_OUTFIT;
const unknown = clips.filter(c => !(c in COMPILED_CLIPS));
if (unknown.length) throw new Error(`no clip named ${unknown.join(', ')}`);

const boneNames = HUMANOID_V1.bones.map(b => b.name);

/** The outfit's pieces for a view in the rig's resting draw order, and that order in every variant. */
function piecesOf(view: RigView) {
  const pieces = outfit.flatMap(id => {
    const dir = join(ART_DIR, id, view);
    if (!existsSync(join(ART_DIR, id))) throw new Error(`no art for wearable "${id}" in ${ART_DIR}`);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => {
      const parts = f.replace(/\.svg$/, '').split('.');
      const band = (['behind', 'front'].includes(parts[parts.length - 1]) ? parts.pop() : 'body') as DrawBand;
      const layer = parts.pop()!;
      const bone = parts.join('.') as BoneName;
      const svg = readFileSync(join(dir, f), 'utf8');
      const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
      return { bone, band, inner, rank: drawRank(view, `${bone}/${layer}` as SlotName, band) };
    });
  }).sort((a, b) => a.rank - b.rank);
  const index = pieces.map((_, i) => i);
  // Only the order matters here, so the index list stands in for every column of the draw list.
  const list = { bone: index, src: index, srcMirror: index, pivotX: index, pivotXMirror: index, pivotY: index, pivotYMirror: index };
  const orders = orderVariants(view, pieces, list as never).map(v => v.bone);
  return { pieces, orders };
}

async function sheet(view: RigView) {
  const { pieces, orders } = piecesOf(view);
  const origins = frameOrigins(view, 'east');
  const width = LABEL_W + frames * CELL_W * S;
  const height = clips.length * FRAME_PX_H;
  const cells: string[] = [];

  clips.forEach((id, row) => {
    const clip = COMPILED_CLIPS[id as keyof typeof COMPILED_CLIPS][view];
    const top = row * FRAME_PX_H;
    cells.push(
      `<line x1="0" y1="${top + ROOT_Y * S}" x2="${width}" y2="${top + ROOT_Y * S}" stroke="#3a3"/>`,
      `<text x="8" y="${top + 28}" font-size="20" fill="#ddd" font-family="sans-serif">${id}</text>`,
      `<text x="8" y="${top + 50}" font-size="15" fill="#888" font-family="sans-serif">${view}</text>`,
    );
    for (let f = 0; f < frames; f++) {
      // Looping clips are sampled over one whole cycle; one-shots skip their resting ends.
      const t = clip.loop ? (f / frames) * clip.duration : ((f + 1) / (frames + 1)) * clip.duration;
      const world = solveWorld(samplePose(clip, t), view);
      const cx = LABEL_W + (f + 0.5) * CELL_W * S;
      for (const i of orders[orderVariantOf(world, view)]) {
        const p = pieces[i];
        const b = boneNames.indexOf(p.bone);
        const o = origins[p.bone];
        const deg = (world.angle[b] * 180) / Math.PI;
        cells.push(`<g transform="translate(${cx + world.x[b] * S} ${top + (ROOT_Y + world.y[b]) * S}) rotate(${deg}) translate(${-o.x} ${-o.y})">${p.inner}</g>`);
      }
      cells.push(`<text x="${cx}" y="${top + 16}" font-size="13" fill="#888" text-anchor="middle" font-family="sans-serif">${t.toFixed(2)}s</text>`);
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#222"/>${cells.join('')}</svg>`;
  const file = views.length > 1 ? out.replace(/(\.png)?$/, `-${view}.png`) : out;
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(file);
  console.log('wrote', file);
}

/** How often each clip changes its limb order at 60 fps. Returns the steady clips that move an arm. */
function orderReport(): string[] {
  const failures: string[] = [];
  console.log('\nlimb order changes per play (arm changes / all changes)');
  for (const id of clips) {
    const cols = views.map(view => {
      const clip = COMPILED_CLIPS[id as keyof typeof COMPILED_CLIPS][view];
      let prev = -1, all = 0, arm = 0;
      for (let t = 0; t <= clip.duration; t += 1 / 60) {
        const v = orderVariantOf(solveWorld(samplePose(clip, t), view), view);
        if (prev >= 0 && v !== prev) {
          all++;
          if ((v & ARM_BITS) !== (prev & ARM_BITS)) arm++;
        }
        prev = v;
      }
      if (arm > 0 && STEADY.has(id)) failures.push(`${id} (${view})`);
      return `${view} ${arm}/${all}`;
    });
    console.log(`  ${id.padEnd(14)} ${cols.join('   ')}`);
  }
  return failures;
}

async function main() {
  for (const view of views) await sheet(view);
  const failures = orderReport();
  if (failures.length) {
    console.error(`\nFAIL: an arm changes sides during ${failures.join(', ')}. Sleeves will flicker; see skeleton/limbOrder.ts.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
