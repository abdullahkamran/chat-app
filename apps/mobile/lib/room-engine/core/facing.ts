import { CharacterDirection, Facing } from '@chat-app/shared-types';

/**
 * Facing for a move by (dgx, dgy) grid cells.
 *
 * In screen space a grid step moves by (dgx - dgy) horizontally and (dgx + dgy)
 * vertically (see gridToScreen), so the signs of those give east/west and
 * south/north. Ties fall to east and south.
 */
export function facingFromDelta(dgx: number, dgy: number): Facing {
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
