/**
 * Skeletal avatar rig and animation clip types (Skia room engine).
 *
 * Every avatar shares one rig. Wearables fill named slots on its bones, and clips
 * animate bones, never clothing, so any clip works with any outfit.
 */

export type RigId = 'humanoid-v1';

/** Drawn 3/4 views. SE/SW use `front`, NE/NW use `back`; the west pair is mirrored. */
export type RigView = 'front' | 'back';

/** humanoid-v1 bones, parents before children. */
export const HUMANOID_V1_BONES = [
  'root',
  'hip',
  'spine',
  'chest',
  'neck',
  'head',
  'upperArm.L',
  'foreArm.L',
  'hand.L',
  'upperArm.R',
  'foreArm.R',
  'hand.R',
  'thigh.L',
  'shin.L',
  'foot.L',
  'thigh.R',
  'shin.R',
  'foot.R',
] as const;

export type BoneName = (typeof HUMANOID_V1_BONES)[number];

/** Layers a bone can carry, in draw order within the bone. Head layers follow today's face-feature order. */
export type SlotLayer =
  | 'skin'
  | 'bottoms'
  | 'tops'
  | 'footwear'
  | 'wristwear'
  | 'face'
  | 'eye'
  | 'nose'
  | 'mouth'
  | 'facialHair'
  | 'hair'
  | 'headwear'
  | 'facewear';

export type SlotName = `${BoneName}/${SlotLayer}`;

export interface RigBone {
  name: BoneName;
  parent?: BoneName;
  /** Offset from the parent's origin in the front view, in pixels at zoom 1 (y down). */
  x: number;
  y: number;
  /** Bind rotation in degrees, clockwise. */
  rotation: number;
  /** Signed length along the bone's local y axis: positive hangs down, negative points up. */
  length: number;
}

export interface RigDefinition {
  id: RigId;
  /** Parents before children. */
  bones: RigBone[];
  slots: Array<{ name: SlotName; bone: BoneName }>;
  /** Back to front. The far arm draws behind the torso, and near/far swap between views. */
  drawOrder: Record<RigView, SlotName[]>;
}

export type ClipEase = 'linear' | 'stepped' | 'inOut';

/** A keyframe. `v` is degrees for rotate, [x, y] pixels for translate. */
export interface ClipKey<V extends number | [number, number] = number | [number, number]> {
  t: number;
  v: V;
  /** Easing from this key to the next. Defaults to linear. */
  ease?: ClipEase;
}

export interface BoneTrack {
  /** Degrees, relative to the bind pose. */
  rotate?: ClipKey<number>[];
  /** Pixels, relative to the bind pose (hip bob, the sit drop). */
  translate?: ClipKey<[number, number]>[];
}

export interface AnimationClip {
  /** 'idle' | 'walk' | 'sit' | emote names from the Animation catalog. */
  name: string;
  view: RigView;
  /** Seconds. */
  duration: number;
  loop: boolean;
  tracks: Partial<Record<BoneName, BoneTrack>>;
  events?: Array<{ t: number; name: 'footstep' | 'complete' }>;
}

/** Atlas pixels per content pixel for wearable art: sharp at the 1.5x max zoom on a 2x screen. */
export const WEARABLE_ART_SCALE = 3;

/** A rect in an atlas, in atlas pixels. */
export interface AtlasRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One sprite in an atlas and the bone origin inside it, in atlas pixels. */
export interface AtlasSprite {
  region: AtlasRegion;
  pivot: { x: number; y: number };
}

/**
 * One piece of a wearable, attached to a slot. Views face screen right; `west` is
 * what the mirrored facings (SW, NW) draw, because a drawAtlas transform can't flip.
 * The packer makes it a flipped copy of `east`, or the item's own west art when the
 * item isn't mirrorable (one-sided logos, side-parted hair).
 */
export interface Attachment {
  slot: SlotName;
  east: AtlasSprite;
  west: AtlasSprite;
  /** Drawn in white and tinted at runtime: skin and face layers by skin tone, others by the variant colour. */
  tintable?: boolean;
}

/** A packed wearable: one atlas per item variant, written by the backend pack script. */
export interface WearableAsset {
  rig: RigId;
  /** Server path of the atlas PNG (e.g. `/wearables/jeans-blue.png`), resolved against the API origin. */
  atlasUrl: string;
  /** Changes whenever the atlas does; clients cache by it. */
  atlasVersion: number;
  /** Atlas pixels per content pixel (WEARABLE_ART_SCALE when packed). */
  scale: number;
  /** Attachments per view, in no particular order: the rig's draw order decides stacking. */
  views: Record<RigView, Attachment[]>;
}
