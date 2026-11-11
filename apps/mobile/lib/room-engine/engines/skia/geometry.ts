import {
  TILE_H,
  TILE_W,
  WALL_HEIGHT,
  getEffectiveDimensions,
  gridToScreen,
  roomCorner,
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

/** An axis-aligned box in content (pre-camera) pixels. */
export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Breathing room around the room when the camera reaches its edge. */
const BOUNDS_PAD = { side: 24, top: 16, bottom: 48 };

/**
 * The part of the content the camera may show: the floor diamond from its left to its
 * right corner, the walls above it, and its front corner, plus some padding.
 */
export function roomContentBounds(origin: GridOrigin, dims: { x: number; y: number }): ContentBounds {
  const left = gridToScreen(-0.5, dims.y - 0.5, 0, origin);
  const right = gridToScreen(dims.x - 0.5, -0.5, 0, origin);
  const front = gridToScreen(dims.x - 0.5, dims.y - 0.5, 0, origin);
  return {
    minX: left.x - BOUNDS_PAD.side,
    maxX: right.x + BOUNDS_PAD.side,
    minY: roomCorner(origin).y - WALL_HEIGHT - BOUNDS_PAD.top,
    maxY: front.y + BOUNDS_PAD.bottom,
  };
}

/**
 * Screen rectangle an item's image is fitted into, in content (pre-camera) pixels: the
 * bounding box of its footprint raised by its height. The footprint covers cells
 * position .. position + dims - 1, which are centred on grid points, so its left corner
 * is (x - 0.5, y + dy - 0.5) and its front corner (x + dx - 0.5, y + dy - 0.5).
 */
export function itemRect(roomItem: RoomItem, origin: GridOrigin): ScreenRect {
  const dims = getEffectiveDimensions(roomItem.itemId.dimensions, roomItem.orientation);
  const { x: gx, y: gy, z: gz } = roomItem.position;
  const left = gridToScreen(gx - 0.5, gy + dims.y - 0.5, gz, origin);
  const front = gridToScreen(gx + dims.x - 0.5, gy + dims.y - 0.5, gz, origin);
  const width = (dims.x + dims.y) * (TILE_W / 2);
  const height = (dims.x + dims.y) * (TILE_H / 2) + dims.z * TILE_H;
  return { x: left.x, y: front.y - height, width, height };
}

/** Painter's-algorithm key for an item: its footprint centre, so big items sort in front of what they cover. */
export function itemDepth(roomItem: RoomItem): number {
  const { position, itemId } = roomItem;
  return position.x + position.y + itemId.dimensions.x / 2 + itemId.dimensions.y / 2;
}

function contains(rect: ScreenRect, p: ScreenPoint): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

/**
 * Front-most item whose image rectangle contains the point, if any. Only interactive
 * items unless `includeDecor` (edit mode picks up anything).
 */
export function hitTestItems(
  items: readonly RoomItem[],
  point: ScreenPoint,
  origin: GridOrigin,
  includeDecor = false,
): RoomItem | null {
  const frontToBack = items
    .filter(ri => includeDecor || ri.itemId.action !== ItemAction.NONE)
    .sort((a, b) => itemDepth(b) - itemDepth(a));
  return frontToBack.find(ri => contains(itemRect(ri, origin), point)) ?? null;
}

/** Half the width of an avatar's tap target, in content pixels. */
const ACTOR_HIT_HALF_W = 16;

/**
 * Front-most avatar whose body is under the point, if any, at the positions drawn now.
 * Reads the motion shared values from the JS thread, which is fine for a tap.
 */
export function hitTestActors(
  motions: ReadonlyMap<string, { gx: { get(): number }; gy: { get(): number }; gz: { get(): number } }>,
  point: ScreenPoint,
  origin: GridOrigin,
  avatarHeight: number,
): string | null {
  let best: string | null = null;
  let bestDepth = -Infinity;
  for (const [id, m] of motions) {
    const gx = m.gx.get();
    const gy = m.gy.get();
    const feet = gridToScreen(gx, gy, m.gz.get(), origin);
    const rect = { x: feet.x - ACTOR_HIT_HALF_W, y: feet.y - avatarHeight, width: ACTOR_HIT_HALF_W * 2, height: avatarHeight + 4 };
    if (contains(rect, point) && gx + gy > bestDepth) {
      best = id;
      bestDepth = gx + gy;
    }
  }
  return best;
}

/** Bounds-checked integer cell for an edit-mode tap, or null when it misses the floor. */
export function cellAt(gx: number, gy: number, dims: { x: number; y: number }) {
  // Edit cells are centred on grid vertices, so round, don't floor.
  const cx = Math.round(gx);
  const cy = Math.round(gy);
  if (cx < 0 || cy < 0 || cx >= dims.x || cy >= dims.y) return null;
  return { gx: cx, gy: cy };
}
