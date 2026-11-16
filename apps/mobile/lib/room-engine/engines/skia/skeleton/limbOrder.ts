import type { BoneName, DrawBand, RigView } from '@chat-app/shared-types';

import type { ViewDrawList } from './avatarArt';
import { BONE_INDEX } from './humanoidV1';
import type { WorldBones } from './sampler';

/**
 * Which limbs draw in front depends on the pose, not only on the side they're on.
 *
 * The rig's draw order (`HUMANOID_V1.drawOrder`) is the resting one: the far leg behind the
 * near leg, and both arms on the side the avatar faces. From the front that's in front of
 * the body, so both arms show when they swing or reach across. From the back it's behind
 * the body: arms in front of someone walking away are hidden by their back, never drawn
 * across it. The engine picks one of a few orders each frame:
 *
 * - An arm swung well back (the wind-up of a throw) moves to the other side: behind the
 *   body from the front, in front of it from the back.
 * - The leg that is further forward is nearer the viewer from the front and further away
 *   from the back, so the legs swap as they pass each other.
 *
 * An arm never changes sides while idling or walking: a sleeve overlaps the shirt at the
 * shoulder, and swapping which one is on top every stride shows as a flicker of shading.
 * The threshold below is well clear of both clips, so arms only move in emotes.
 *
 * Every art (composed outfits, the loading ghost) carries its draw list in each of these
 * orders, built once, so the frame loop only picks an index.
 */

/** Bits of an order variant. */
export const FAR_ARM_BEHIND = 1;
export const NEAR_ARM_BEHIND = 2;
export const LEGS_SWAPPED = 4;
export const ORDER_VARIANTS = 8;

const RAD = Math.PI / 180;
/** An upper arm turned this far back from the chest is swung back. A walking arm reaches 14 degrees. */
const SWUNG_BACK = 30 * RAD;
/** How far ahead of the other foot a foot must be for its leg to swap. */
const LEG_LEAD = 2;

type Part = 'farArm' | 'nearArm' | 'farLeg' | 'nearLeg' | 'skirt' | 'torso';

function partOf(bone: BoneName, view: RigView): Part {
  const far = view === 'front' ? '.R' : '.L';
  const isFar = bone.endsWith(far);
  if (bone.startsWith('upperArm') || bone.startsWith('foreArm') || bone.startsWith('hand')) return isFar ? 'farArm' : 'nearArm';
  if (bone.startsWith('thigh') || bone.startsWith('shin') || bone.startsWith('foot')) return isFar ? 'farLeg' : 'nearLeg';
  if (bone.startsWith('skirt')) return 'skirt';
  return 'torso';
}

/** A piece of a view's draw list, in the rig's resting draw order. */
export interface OrderedPiece {
  bone: BoneName;
  band: DrawBand;
}

function pick<T>(items: T[], order: number[]): T[] {
  return order.map(i => items[i]);
}

/**
 * A view's draw list in every order variant (index = variant bits). Only `body` band pieces
 * move; a piece drawn `behind` or in `front` of the whole avatar stays there.
 */
export function orderVariants(view: RigView, pieces: OrderedPiece[], list: ViewDrawList): ViewDrawList[] {
  const of = (band: DrawBand, part?: Part) =>
    pieces.flatMap((p, i) => (p.band === band && (!part || partOf(p.bone, view) === part) ? [i] : []));
  const behind = of('behind');
  const front = of('front');
  const farArm = of('body', 'farArm');
  const nearArm = of('body', 'nearArm');
  const farLeg = of('body', 'farLeg');
  const nearLeg = of('body', 'nearLeg');
  const skirt = of('body', 'skirt');
  const torso = of('body', 'torso');

  const out: ViewDrawList[] = [];
  for (let v = 0; v < ORDER_VARIANTS; v++) {
    const farBehind = (v & FAR_ARM_BEHIND) !== 0;
    const nearBehind = (v & NEAR_ARM_BEHIND) !== 0;
    const order = [
      ...behind,
      // An arm behind the body is behind all of it: the legs and any skirt as well as the
      // torso, or a hand passing the hips would show over the trousers.
      ...(farBehind ? farArm : []),
      ...(nearBehind ? nearArm : []),
      ...((v & LEGS_SWAPPED) !== 0 ? [...nearLeg, ...farLeg] : [...farLeg, ...nearLeg]),
      ...skirt,
      ...torso,
      ...(farBehind ? [] : farArm),
      ...(nearBehind ? [] : nearArm),
      ...front,
    ];
    out.push({
      bone: pick(list.bone, order),
      src: pick(list.src, order),
      srcMirror: pick(list.srcMirror, order),
      pivotX: pick(list.pivotX, order),
      pivotXMirror: pick(list.pivotXMirror, order),
      pivotY: pick(list.pivotY, order),
      pivotYMirror: pick(list.pivotYMirror, order),
    });
  }
  return out;
}

const CHEST = BONE_INDEX.chest;
const side = (s: 'L' | 'R') => ({
  upperArm: BONE_INDEX[`upperArm.${s}`],
  hipJoint: BONE_INDEX[`thigh.${s}`],
  foot: BONE_INDEX[`foot.${s}`],
});
/** Bone indices of the far and near limbs in each view (the back view shows the other side). */
const LIMBS = {
  front: { far: side('R'), near: side('L') },
  back: { far: side('L'), near: side('R') },
};

/** Whether an arm draws behind the body. Angles are clockwise: swinging back is positive. */
function armBehind(angle: number[], upperArm: number, view: RigView): boolean {
  'worklet';
  const swungBack = angle[upperArm] - angle[CHEST] > SWUNG_BACK;
  return view === 'front' ? swungBack : !swungBack;
}

/**
 * The order variant for a solved pose. `bones` are unmirrored: forward is +x in both views.
 */
export function orderVariantOf(bones: WorldBones, view: RigView): number {
  'worklet';
  const { far, near } = LIMBS[view];
  const { x, angle } = bones;
  const farLegLead = (x[far.foot] - x[far.hipJoint]) - (x[near.foot] - x[near.hipJoint]);
  return (armBehind(angle, far.upperArm, view) ? FAR_ARM_BEHIND : 0)
    | (armBehind(angle, near.upperArm, view) ? NEAR_ARM_BEHIND : 0)
    | ((view === 'front' ? farLegLead : -farLegLead) > LEG_LEAD ? LEGS_SWAPPED : 0);
}
