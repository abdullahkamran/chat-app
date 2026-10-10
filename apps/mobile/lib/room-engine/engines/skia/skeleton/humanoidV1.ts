import {
  HUMANOID_V1_BONES,
  type BoneName,
  type RigBone,
  type RigDefinition,
  type RigView,
  type SlotLayer,
  type SlotName,
} from '@chat-app/shared-types';

/** Avatar height in content pixels at zoom 1 (feet to top of head), same as the legacy character. */
export const AVATAR_HEIGHT = 80;

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
];

const BODY_LAYERS: SlotLayer[] = ['skin', 'bottoms', 'tops', 'footwear', 'wristwear'];
const HEAD_LAYERS: SlotLayer[] = [
  'skin', 'face', 'eye', 'nose', 'mouth', 'facialHair', 'hair', 'headwear', 'facewear',
];

function layersOf(bone: BoneName): SlotLayer[] {
  if (bone === 'root') return [];
  return bone === 'head' ? HEAD_LAYERS : BODY_LAYERS;
}

/** Bones back to front in the front view: far (right) limbs, legs, torso, head, near (left) arm. */
const FRONT_BONE_ORDER: BoneName[] = [
  'upperArm.R', 'foreArm.R', 'hand.R',
  'thigh.R', 'shin.R', 'foot.R',
  'thigh.L', 'shin.L', 'foot.L',
  'hip', 'spine', 'chest', 'neck', 'head',
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

export const BONE_COUNT = BONES.length;

/** Index of each bone in `HUMANOID_V1.bones`. */
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b.name, i])) as Record<BoneName, number>;

/**
 * Flat bind-pose arrays for the UI-thread solver. Parents precede children, so one
 * forward pass builds world transforms. The back view mirrors the bind x offsets
 * (the avatar's left side is on screen left when seen from behind); rotations keep
 * their meaning, so "forward" stays towards screen right in both views.
 */
export interface RigArrays {
  parent: number[];
  bindX: Record<RigView, number[]>;
  bindY: number[];
  bindRotation: number[];
}

export const RIG_ARRAYS: RigArrays = {
  parent: BONES.map(b => (b.parent ? BONE_INDEX[b.parent] : -1)),
  bindX: { front: BONES.map(b => b.x), back: BONES.map(b => -b.x) },
  bindY: BONES.map(b => b.y),
  bindRotation: BONES.map(b => b.rotation),
};
