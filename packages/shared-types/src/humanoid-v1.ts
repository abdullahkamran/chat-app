import {
  DRAW_BANDS,
  HUMANOID_V1_BONES,
  type DrawBand,
  type BoneName,
  type RigBone,
  type RigDefinition,
  type RigView,
  type SlotLayer,
  type SlotName,
} from './rig.types';

/**
 * The humanoid-v1 rig as data, shared by the Skia engine and the backend art scripts
 * (rig template, atlas packer), so every tool agrees on bone positions and draw order.
 */

/**
 * Bind pose in the front view (facing SE: towards the viewer, turned to screen right).
 * The avatar's left side is nearer the viewer and sits at +x. Root is the ground point
 * between the feet. Limbs hang down (+length); the torso and head point up (-length).
 */
const BONES: RigBone[] = [
  { name: 'root', x: 0, y: 0, rotation: 0, length: 0 },
  { name: 'hip', parent: 'root', x: 0, y: -34, rotation: 0, length: 0 },
  { name: 'spine', parent: 'hip', x: 0, y: -2, rotation: 0, length: -10 },
  { name: 'chest', parent: 'spine', x: 0, y: -10, rotation: 0, length: -14 },
  { name: 'neck', parent: 'chest', x: 0, y: -14, rotation: 0, length: -4 },
  { name: 'head', parent: 'neck', x: 0, y: -4, rotation: 0, length: -16 },
  { name: 'upperArm.L', parent: 'chest', x: 7, y: -12, rotation: 0, length: 12 },
  { name: 'foreArm.L', parent: 'upperArm.L', x: 0, y: 12, rotation: 0, length: 11 },
  { name: 'hand.L', parent: 'foreArm.L', x: 0, y: 11, rotation: 0, length: 4 },
  { name: 'upperArm.R', parent: 'chest', x: -7, y: -12, rotation: 0, length: 12 },
  { name: 'foreArm.R', parent: 'upperArm.R', x: 0, y: 12, rotation: 0, length: 11 },
  { name: 'hand.R', parent: 'foreArm.R', x: 0, y: 11, rotation: 0, length: 4 },
  { name: 'thigh.L', parent: 'hip', x: 4, y: 0, rotation: 0, length: 17 },
  { name: 'shin.L', parent: 'thigh.L', x: 0, y: 17, rotation: 0, length: 15 },
  { name: 'foot.L', parent: 'shin.L', x: 0, y: 15, rotation: 0, length: 2 },
  { name: 'thigh.R', parent: 'hip', x: -4, y: 0, rotation: 0, length: 17 },
  { name: 'shin.R', parent: 'thigh.R', x: 0, y: 17, rotation: 0, length: 15 },
  { name: 'foot.R', parent: 'shin.R', x: 0, y: 15, rotation: 0, length: 2 },
  // Followers. Skirt panels hang from the hip at the thighs and swing half as far, so
  // long coats and skirts move with the legs without splitting at the hip.
  { name: 'skirt.L', parent: 'hip', x: 4, y: 0, rotation: 0, length: 30, follow: { bone: 'thigh.L', weight: 0.5 } },
  { name: 'skirt.R', parent: 'hip', x: -4, y: 0, rotation: 0, length: 30, follow: { bone: 'thigh.R', weight: 0.5 } },
  // Long hair below the head: pivots where the head does but turns only half as far.
  { name: 'hairBack', parent: 'neck', x: 0, y: -4, rotation: 0, length: 24, follow: { bone: 'head', weight: 0.5 } },
];

const BODY_LAYERS: SlotLayer[] = ['skin', 'bottoms', 'tops', 'footwear', 'wristwear'];
const NECK_LAYERS: SlotLayer[] = [...BODY_LAYERS, 'neckwear'];
const SKIRT_LAYERS: SlotLayer[] = ['bottoms', 'tops'];
const HEAD_LAYERS: SlotLayer[] = [
  'skin', 'face', 'eye', 'nose', 'mouth', 'facialHair', 'hair', 'headwear', 'facewear',
];

function layersOf(bone: BoneName): SlotLayer[] {
  switch (bone) {
    case 'root': return [];
    case 'head': return HEAD_LAYERS;
    case 'hairBack': return ['hair'];
    case 'neck':
    case 'chest': return NECK_LAYERS;
    case 'skirt.L':
    case 'skirt.R': return SKIRT_LAYERS;
    default: return BODY_LAYERS;
  }
}

/**
 * Bones back to front in the front view: far (right) limbs, legs, skirt panels, torso,
 * head, near (left) arm. Within the `body` band only; see `DrawBand`.
 */
const FRONT_BONE_ORDER: BoneName[] = [
  'upperArm.R', 'foreArm.R', 'hand.R',
  'thigh.R', 'shin.R', 'foot.R',
  'thigh.L', 'shin.L', 'foot.L',
  'skirt.R', 'skirt.L',
  'hip', 'spine', 'chest', 'neck', 'hairBack', 'head',
  'upperArm.L', 'foreArm.L', 'hand.L',
];

/** In the back view the avatar's right side is nearer, so left and right swap. */
function swapSide(bone: BoneName): BoneName {
  if (bone.endsWith('.L')) return bone.replace(/\.L$/, '.R') as BoneName;
  if (bone.endsWith('.R')) return bone.replace(/\.R$/, '.L') as BoneName;
  return bone;
}

const BONE_ORDER: Record<RigView, BoneName[]> = {
  front: FRONT_BONE_ORDER,
  back: FRONT_BONE_ORDER.map(swapSide),
};

function slotsInOrder(view: RigView): SlotName[] {
  return BONE_ORDER[view].flatMap(bone => layersOf(bone).map(layer => `${bone}/${layer}` as SlotName));
}

export const HUMANOID_V1: RigDefinition = {
  id: 'humanoid-v1',
  bones: BONES,
  slots: HUMANOID_V1_BONES.flatMap(bone => layersOf(bone).map(layer => ({
    name: `${bone}/${layer}` as SlotName,
    bone,
  }))),
  drawOrder: { front: slotsInOrder('front'), back: slotsInOrder('back') },
};

function rankOf(view: RigView): Partial<Record<SlotName, number>> {
  const out: Partial<Record<SlotName, number>> = {};
  HUMANOID_V1.drawOrder[view].forEach((slot, i) => { out[slot] = i; });
  return out;
}

const SLOT_RANK: Record<RigView, Partial<Record<SlotName, number>>> = { front: rankOf('front'), back: rankOf('back') };

/** Stacking key for a piece, lowest drawn first: its band, then the rig's draw order. */
export function drawRank(view: RigView, slot: SlotName, band: DrawBand = 'body'): number {
  return DRAW_BANDS.indexOf(band) * HUMANOID_V1.slots.length + (SLOT_RANK[view][slot] ?? 0);
}

/** The bone a slot hangs from: `'shin.L/bottoms'` → `'shin.L'`. */
export function slotBone(slot: SlotName): BoneName {
  return slot.slice(0, slot.lastIndexOf('/')) as BoneName;
}

/**
 * Bone origins in the bind pose for one view, in content pixels relative to the root
 * (feet at 0, 0; y down). The back view mirrors x, because the avatar's left side is
 * on screen left when seen from behind. Bind rotations are all zero, so offsets add up.
 */
export function bindOrigins(view: RigView): Record<BoneName, { x: number; y: number }> {
  const out = {} as Record<BoneName, { x: number; y: number }>;
  const sign = view === 'back' ? -1 : 1;
  for (const bone of BONES) {
    const parent = bone.parent ? out[bone.parent] : { x: 0, y: 0 };
    out[bone.name] = { x: parent.x + sign * bone.x, y: parent.y + bone.y };
  }
  return out;
}
