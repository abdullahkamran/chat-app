/**
 * Writes the humanoid-v1 rig template: the frames artists draw wearable pieces on.
 *
 *   pnpm --filter @chat-app/backend art:template
 *
 * One SVG per view and side in art/rig-template/. Each shows the export frame, the
 * ground line, a ghost of the bare body, and every bone with its origin (the joint
 * a piece rotates about) and name. Follower bones are dashed and say what they follow.
 * See art/README.md for the drawing rules.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { HUMANOID_V1, WEARABLE_ART_SCALE, type RigView } from '@chat-app/shared-types';

import { FRAME_PX_H, FRAME_PX_W, ROOT_Y, frameOrigins, type Side } from './wearables/frame';
import { bodyShapes, shapeSvg } from './wearables/shapes';

const OUT_DIR = join(__dirname, '..', 'art', 'rig-template');
const S = WEARABLE_ART_SCALE;

// Template-only drawing colours (not app UI, so they don't come from the mobile theme).
const GHOST_FILL = '#e8e8e8';
const GHOST_STROKE = '#b0b0b0';
const BONE = '#2f80ed';
const FOLLOWER = '#9b51e0';
const JOINT = '#eb5757';
const GROUND = '#27ae60';
const LABEL = '#333333';

function template(view: RigView, side: Side): string {
  const origins = frameOrigins(view, side);
  const flip = side === 'west' ? -1 : 1;
  const ghost = bodyShapes(view);
  const parts: string[] = [];

  parts.push(`<rect x="0" y="0" width="${FRAME_PX_W}" height="${FRAME_PX_H}" fill="none" stroke="${LABEL}" stroke-dasharray="4 4"/>`);
  parts.push(`<line x1="0" y1="${ROOT_Y * S}" x2="${FRAME_PX_W}" y2="${ROOT_Y * S}" stroke="${GROUND}"/>`);

  // Ghost body in draw order, so the far limbs sit behind.
  for (const slot of HUMANOID_V1.drawOrder[view]) {
    if (!slot.endsWith('/skin')) continue;
    const bone = slot.slice(0, slot.lastIndexOf('/')) as keyof typeof ghost;
    const shape = ghost[bone];
    if (!shape) continue;
    const o = origins[bone];
    parts.push(
      `<g transform="translate(${o.x} ${o.y}) scale(${flip * S} ${S})">${shapeSvg(shape, `fill="${GHOST_FILL}" stroke="${GHOST_STROKE}" stroke-width="0.3"`)}</g>`,
    );
  }

  for (const bone of HUMANOID_V1.bones) {
    if (bone.name === 'root') continue;
    const o = origins[bone.name];
    // Followers share a joint with the bone they follow, so their line and label are offset.
    const follower = bone.follow !== undefined;
    if (bone.length !== 0) {
      const dash = follower ? ' stroke-dasharray="3 2"' : '';
      parts.push(`<line x1="${o.x}" y1="${o.y}" x2="${o.x}" y2="${o.y + bone.length * S}" stroke="${follower ? FOLLOWER : BONE}" stroke-width="1.5"${dash}/>`);
    }
    parts.push(`<circle cx="${o.x}" cy="${o.y}" r="2.5" fill="${JOINT}"/>`);
    const near = bone.name.endsWith(view === 'front' ? '.L' : '.R');
    const dx = (near ? 6 : -6) * flip;
    const label = follower ? `${bone.name} (${bone.follow!.weight} × ${bone.follow!.bone})` : bone.name;
    const y = follower ? o.y + 10 : o.y + 2;
    parts.push(
      `<text x="${o.x + dx}" y="${y}" font-family="sans-serif" font-size="6" fill="${follower ? FOLLOWER : LABEL}" text-anchor="${dx > 0 ? 'start' : 'end'}">${label}</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_PX_W}" height="${FRAME_PX_H}" viewBox="0 0 ${FRAME_PX_W} ${FRAME_PX_H}">`,
    `<!-- humanoid-v1 ${view} view, ${side}-facing. Export every piece at ${FRAME_PX_W}x${FRAME_PX_H}, frame-aligned. -->`,
    ...parts,
    '</svg>',
    '',
  ].join('\n');
}

mkdirSync(OUT_DIR, { recursive: true });
for (const view of ['front', 'back'] as RigView[]) {
  for (const side of ['east', 'west'] as Side[]) {
    const name = `humanoid-v1-${view}${side === 'west' ? '-west' : ''}.svg`;
    writeFileSync(join(OUT_DIR, name), template(view, side));
    console.log(`wrote ${name}`);
  }
}
