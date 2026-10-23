import { getEffectiveDimensions } from '@/constants/grid';
import type { Dimensions, RoomItem } from '@chat-app/shared-types';

/** Whether a placed item's footprint covers the cell. */
function covers(ri: RoomItem, gx: number, gy: number): boolean {
  const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
  const { x, y } = ri.position;
  return gx >= x && gx < x + dims.x && gy >= y && gy < y + dims.y;
}

/** The front-most placed item whose footprint covers the cell, if any. */
export function itemCovering(items: readonly RoomItem[], gx: number, gy: number): RoomItem | null {
  let found: RoomItem | null = null;
  for (const ri of items) {
    if (covers(ri, gx, gy) && (!found || ri.position.x + ri.position.y >= found.position.x + found.position.y)) {
      found = ri;
    }
  }
  return found;
}

/**
 * Whether `candidate` fits: its footprint is inside the room and doesn't overlap a
 * solid item. Overlappable items (rugs) neither block nor are blocked. `ignore` is the
 * item being moved, which mustn't block itself.
 */
export function fitsAt(
  items: readonly RoomItem[],
  candidate: RoomItem,
  room: Dimensions,
  ignore: RoomItem | null = null,
): boolean {
  const dims = getEffectiveDimensions(candidate.itemId.dimensions, candidate.orientation);
  const { x, y } = candidate.position;
  if (x < 0 || y < 0 || x + dims.x > room.x || y + dims.y > room.y) return false;
  if (candidate.itemId.isOverlappable) return true;
  return !items.some(ri => {
    if (ri === ignore || ri.itemId.isOverlappable) return false;
    for (let dx = 0; dx < dims.x; dx++) {
      for (let dy = 0; dy < dims.y; dy++) {
        if (covers(ri, x + dx, y + dy)) return true;
      }
    }
    return false;
  });
}
