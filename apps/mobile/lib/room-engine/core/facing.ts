import { CharacterDirection, Facing, type RigView } from '@chat-app/shared-types';

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

/** Collapse a facing to the two directions a mirrored sprite can show. */
export function facingToDirection(facing: Facing): CharacterDirection {
  return facing === Facing.NW || facing === Facing.SW
    ? CharacterDirection.LEFT
    : CharacterDirection.RIGHT;
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
