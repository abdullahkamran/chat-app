import { Facing, type RigView } from '@chat-app/shared-types';

/**
 * Facing for a move by (dgx, dgy) grid cells.
 *
 * In screen space a grid step moves by (dgx - dgy) horizontally and (dgx + dgy)
 * vertically (see gridToScreen), so the signs of those give east/west and
 * south/north. Ties fall to east and south. A worklet, so engines can derive
 * facing from motion on the UI thread.
 */
export function facingFromDelta(dgx: number, dgy: number): Facing {
  'worklet';
  const east = dgx - dgy >= 0;
  const south = dgx + dgy >= 0;
  if (south) return east ? Facing.SE : Facing.SW;
  return east ? Facing.NE : Facing.NW;
}

/** Below this share of a move, its screen-horizontal or screen-vertical part counts as none. */
const FACING_TIE = 0.05;

/**
 * Facing for a move, keeping `prev`'s east/west or north/south half when the move has
 * next to none of it. A walk straight across the screen (e.g. between whole-cell turn
 * points) moves equally on both grid axes, so its north/south part is rounding noise
 * that would otherwise flip the avatar between its front and back every frame.
 */
export function steadyFacingFromDelta(prev: Facing, dgx: number, dgy: number): Facing {
  'worklet';
  const h = dgx - dgy;
  const v = dgx + dgy;
  const tie = FACING_TIE * (Math.abs(h) + Math.abs(v));
  const east = Math.abs(h) <= tie ? prev === Facing.SE || prev === Facing.NE : h > 0;
  const south = Math.abs(v) <= tie ? prev === Facing.SE || prev === Facing.SW : v > 0;
  if (south) return east ? Facing.SE : Facing.SW;
  return east ? Facing.NE : Facing.NW;
}

/**
 * The drawn rig view for a facing. Views face screen right; the west pair mirrors.
 * This is the one table to extend if eight facings are ever added.
 */
export function facingToView(facing: Facing): { view: RigView; mirror: boolean } {
  'worklet';
  switch (facing) {
    case Facing.SE: return { view: 'front', mirror: false };
    case Facing.SW: return { view: 'front', mirror: true };
    case Facing.NE: return { view: 'back', mirror: false };
    case Facing.NW: return { view: 'back', mirror: true };
  }
}
