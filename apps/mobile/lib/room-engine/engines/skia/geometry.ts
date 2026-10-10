import {
  TILE_H,
  TILE_W,
  getEffectiveDimensions,
  gridToScreen,
  type GridOrigin,
  type ScreenPoint,
} from '@/constants/grid';
import { ItemAction, type RoomItem } from '@chat-app/shared-types';

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Screen rectangle an item's image is fitted into, in content (pre-camera) pixels.
 * Same anchoring as the legacy engine: bottom-centre on the item's grid position.
 */
export function itemRect(roomItem: RoomItem, origin: GridOrigin): ScreenRect {
  const dims = getEffectiveDimensions(roomItem.itemId.dimensions, roomItem.orientation);
  const { x: gx, y: gy, z: gz } = roomItem.position;
  const anchor = gridToScreen(gx, gy, gz, origin);
  const width = (dims.x + dims.y) * (TILE_W / 2);
  const height = (dims.x + dims.y) * (TILE_H / 2) + dims.z * TILE_H;
  return { x: anchor.x - width / 2, y: anchor.y - height, width, height };
}

/** Painter's-algorithm key for an item: its footprint centre, so big items sort in front of what they cover. */
export function itemDepth(roomItem: RoomItem): number {
  const { position, itemId } = roomItem;
  return position.x + position.y + itemId.dimensions.x / 2 + itemId.dimensions.y / 2;
}

function contains(rect: ScreenRect, p: ScreenPoint): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

/** Front-most interactive item whose image rectangle contains the point, if any. */
export function hitTestItems(
  items: readonly RoomItem[],
  point: ScreenPoint,
  origin: GridOrigin,
): RoomItem | null {
  const frontToBack = items
    .filter(ri => ri.itemId.action !== ItemAction.NONE)
    .sort((a, b) => itemDepth(b) - itemDepth(a));
  return frontToBack.find(ri => contains(itemRect(ri, origin), point)) ?? null;
}

/** Bounds-checked integer cell for an edit-mode tap, or null when it misses the floor. */
export function cellAt(gx: number, gy: number, dims: { x: number; y: number }) {
  // Edit cells are centred on grid vertices (matches the legacy GridOverlay), so round, don't floor.
  const cx = Math.round(gx);
  const cy = Math.round(gy);
  if (cx < 0 || cy < 0 || cx >= dims.x || cy >= dims.y) return null;
  return { gx: cx, gy: cy };
}
