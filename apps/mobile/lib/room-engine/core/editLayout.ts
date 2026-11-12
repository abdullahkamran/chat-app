import { WALL_ROWS, getEffectiveDimensions, wallSideOf, type WallCell, type WallSide } from '@/constants/grid';
import { ItemPlacement, Orientiation, type Dimensions, type RoomItem } from '@chat-app/shared-types';
import type { EditCell } from './contract';

const isWallItem = (ri: RoomItem) => ri.itemId.placement === ItemPlacement.WALL;

/** Whether a placed floor item's footprint covers the cell. Wall items cover no floor. */
function covers(ri: RoomItem, gx: number, gy: number): boolean {
  if (isWallItem(ri)) return false;
  const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
  const { x, y } = ri.position;
  return gx >= x && gx < x + dims.x && gy >= y && gy < y + dims.y;
}

/** The front-most placed floor item whose footprint covers the cell, if any. */
export function itemCovering(items: readonly RoomItem[], gx: number, gy: number): RoomItem | null {
  let found: RoomItem | null = null;
  for (const ri of items) {
    if (covers(ri, gx, gy) && (!found || ri.position.x + ri.position.y >= found.position.x + found.position.y)) {
      found = ri;
    }
  }
  return found;
}

/** The wall cells a wall item covers: `width` columns from `col`, `height` rows from `row`. */
function wallSpan(ri: RoomItem) {
  const wall = wallSideOf(ri.orientation);
  return {
    wall,
    col: wall === 'right' ? ri.position.x : ri.position.y,
    row: ri.position.z,
    width: Math.max(1, ri.itemId.dimensions.x),
    height: Math.max(1, ri.itemId.dimensions.z),
  };
}

/** Every wall cell a wall item covers, for drawing. */
export function wallCellsOf(ri: RoomItem): WallCell[] {
  const s = wallSpan(ri);
  const cells: WallCell[] = [];
  for (let c = 0; c < s.width; c++) {
    for (let r = 0; r < s.height; r++) cells.push({ wall: s.wall, col: s.col + c, row: s.row + r });
  }
  return cells;
}

function coversWall(ri: RoomItem, wall: WallSide, col: number, row: number): boolean {
  if (!isWallItem(ri)) return false;
  const s = wallSpan(ri);
  return s.wall === wall && col >= s.col && col < s.col + s.width && row >= s.row && row < s.row + s.height;
}

/** The placed item on a floor or wall cell, if any. */
export function itemOnCell(items: readonly RoomItem[], cell: EditCell): RoomItem | null {
  if (cell.surface === 'floor') return itemCovering(items, cell.gx, cell.gy);
  return items.find(ri => coversWall(ri, cell.wall, cell.col, cell.row)) ?? null;
}

/**
 * The item moved to the cell, anchored there (its back, or bottom, corner on it), or
 * null when the cell is on the wrong surface for it. A wall cell also picks the wall.
 */
export function placedOn(ri: RoomItem, cell: EditCell): RoomItem | null {
  if (cell.surface === 'floor') {
    return isWallItem(ri) ? null : { ...ri, position: { x: cell.gx, y: cell.gy, z: 0 } };
  }
  if (!isWallItem(ri)) return null;
  return cell.wall === 'right'
    ? { ...ri, orientation: Orientiation.ZERO, position: { x: cell.col, y: 0, z: cell.row } }
    : { ...ri, orientation: Orientiation.NINETY, position: { x: 0, y: cell.col, z: cell.row } };
}

/** Whether two placements of an item put it in the same spot. */
export function samePlace(a: RoomItem, b: RoomItem): boolean {
  return a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z
    && (!isWallItem(a) || wallSideOf(a.orientation) === wallSideOf(b.orientation));
}

/** Whether a wall item fits: on its wall, under the ceiling, and clear of other wall items there. */
function fitsOnWall(items: readonly RoomItem[], candidate: RoomItem, room: Dimensions, ignore: RoomItem | null): boolean {
  const s = wallSpan(candidate);
  const length = s.wall === 'right' ? room.x : room.y;
  if (s.col < 0 || s.row < 0 || s.col + s.width > length || s.row + s.height > WALL_ROWS) return false;
  if (candidate.itemId.isOverlappable) return true;
  return !items.some(ri => {
    if (ri === ignore || ri.itemId.isOverlappable || !isWallItem(ri)) return false;
    const o = wallSpan(ri);
    return o.wall === s.wall
      && s.col < o.col + o.width && o.col < s.col + s.width
      && s.row < o.row + o.height && o.row < s.row + s.height;
  });
}

/**
 * Whether `candidate` fits: a floor item's footprint is inside the room and doesn't
 * overlap a solid floor item; a wall item is on its wall clear of other wall items.
 * Overlappable items (rugs) neither block nor are blocked. `ignore` is the item being
 * moved, which mustn't block itself.
 */
export function fitsAt(
  items: readonly RoomItem[],
  candidate: RoomItem,
  room: Dimensions,
  ignore: RoomItem | null = null,
): boolean {
  if (isWallItem(candidate)) return fitsOnWall(items, candidate, room, ignore);
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
