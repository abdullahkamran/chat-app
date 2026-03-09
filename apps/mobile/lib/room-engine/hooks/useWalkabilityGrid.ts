import { useMemo } from 'react';
import { type Dimensions, type RoomItem } from '@chat-app/shared-types';
import { getEffectiveDimensions } from '@/constants/grid';

/**
 * Builds a walkability grid from the room's placed items.
 *
 * A cell is blocked when a non-overlappable item occupies it.
 * Other characters are NOT considered obstacles — they can pass through each other.
 *
 * Returns isWalkable(gx, gy) and the blocked cell Set for inspection.
 */
export function useWalkabilityGrid(
  roomDimensions: Dimensions,
  roomItems: RoomItem[],
) {
  const blockedCells = useMemo(() => {
    const blocked = new Set<string>();

    for (const roomItem of roomItems) {
      const item = roomItem.itemId;
      if (item.isOverlappable) continue;

      const dims = getEffectiveDimensions(item.dimensions, roomItem.orientation);
      const { x: ox, y: oy } = roomItem.position;

      for (let dx = 0; dx < dims.x; dx++) {
        for (let dy = 0; dy < dims.y; dy++) {
          blocked.add(cellKey(ox + dx, oy + dy));
        }
      }
    }

    return blocked;
  }, [roomItems]);

  function isWalkable(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= roomDimensions.x || gy >= roomDimensions.y) {
      return false;
    }
    return !blockedCells.has(cellKey(gx, gy));
  }

  return { isWalkable, blockedCells };
}

function cellKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}
