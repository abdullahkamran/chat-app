import { WALL_ROWS, getEffectiveDimensions, wallSideOf, type WallCell, type WallSide } from '@/constants/grid';
import { ItemPlacement, Orientiation, type Dimensions, type Door, type RoomItem } from '@chat-app/shared-types';
import type { EditCell } from './contract';
import { isDoorCell, overlapsDoor } from './doors';

/** The room an edit lays items out in: its floor size, and its doors, which items must keep clear of. */
export type EditRoom = Pick<Dimensions, 'x' | 'y'> & { doors: readonly Door[] };

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

/** Whether a wall item fits: on its wall, under the ceiling, off any door, and clear of other wall items there. */
function fitsOnWall(items: readonly RoomItem[], candidate: RoomItem, room: EditRoom, ignore: RoomItem | null): boolean {
  const s = wallSpan(candidate);
  const length = s.wall === 'right' ? room.x : room.y;
  if (s.col < 0 || s.row < 0 || s.col + s.width > length || s.row + s.height > WALL_ROWS) return false;
  if (overlapsDoor(room.doors, s.wall, s.col, s.width, s.row, s.height)) return false;
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
 * overlap a solid floor item or a door's cell, so people can always come in; a wall item
 * is on its wall clear of doors and other wall items. Overlappable floor items (rugs)
 * neither block nor are blocked, and may lie in a doorway. `ignore` is the item being
 * moved, which mustn't block itself.
 */
export function fitsAt(
  items: readonly RoomItem[],
  candidate: RoomItem,
  room: EditRoom,
  ignore: RoomItem | null = null,
): boolean {
  if (isWallItem(candidate)) return fitsOnWall(items, candidate, room, ignore);
  const dims = getEffectiveDimensions(candidate.itemId.dimensions, candidate.orientation);
  const { x, y } = candidate.position;
  if (x < 0 || y < 0 || x + dims.x > room.x || y + dims.y > room.y) return false;
  if (candidate.itemId.isOverlappable) return true;
  for (let dx = 0; dx < dims.x; dx++) {
    for (let dy = 0; dy < dims.y; dy++) {
      if (isDoorCell(room.doors, x + dx, y + dy)) return false;
    }
  }
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

/** Whether two items on the same surface overlap (floor footprints, or spans on one wall). */
function overlaps(a: RoomItem, b: RoomItem): boolean {
  if (isWallItem(a) !== isWallItem(b)) return false;
  if (isWallItem(a)) {
    const s = wallSpan(a);
    const o = wallSpan(b);
    return s.wall === o.wall
      && s.col < o.col + o.width && o.col < s.col + s.width
      && s.row < o.row + o.height && o.row < s.row + s.height;
  }
  const da = getEffectiveDimensions(a.itemId.dimensions, a.orientation);
  const db = getEffectiveDimensions(b.itemId.dimensions, b.orientation);
  return a.position.x < b.position.x + db.x && b.position.x < a.position.x + da.x
    && a.position.y < b.position.y + db.y && b.position.y < a.position.y + da.y;
}

/** The cells an item covers where it stands: its floor footprint, or its wall cells. */
export function cellsOf(ri: RoomItem): EditCell[] {
  if (isWallItem(ri)) return wallCellsOf(ri).map(c => ({ surface: 'wall', ...c }));
  const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
  const cells: EditCell[] = [];
  for (let dx = 0; dx < dims.x; dx++) {
    for (let dy = 0; dy < dims.y; dy++) cells.push({ surface: 'floor', gx: ri.position.x + dx, gy: ri.position.y + dy });
  }
  return cells;
}

/**
 * The closest spot to where `ri` stands that it fits in `layout` (which must not hold it),
 * keeping its facing and, for a wall item, its wall. Null when there's none.
 */
function nearestFit(layout: readonly RoomItem[], ri: RoomItem, room: EditRoom): RoomItem | null {
  const spots: { item: RoomItem; distance: number }[] = [];
  if (isWallItem(ri)) {
    const s = wallSpan(ri);
    const length = s.wall === 'right' ? room.x : room.y;
    for (let col = 0; col < length; col++) {
      for (let row = 0; row < WALL_ROWS; row++) {
        const moved = placedOn(ri, { surface: 'wall', wall: s.wall, col, row });
        if (moved) spots.push({ item: moved, distance: (col - s.col) ** 2 + (row - s.row) ** 2 });
      }
    }
  } else {
    for (let x = 0; x < room.x; x++) {
      for (let y = 0; y < room.y; y++) {
        spots.push({
          item: { ...ri, position: { x, y, z: 0 } },
          distance: (x - ri.position.x) ** 2 + (y - ri.position.y) ** 2,
        });
      }
    }
  }
  // Nearest first; among equals, the one further back, so things shuffle back rather than forward.
  spots.sort((a, b) => a.distance - b.distance
    || (a.item.position.x + a.item.position.y + a.item.position.z) - (b.item.position.x + b.item.position.y + b.item.position.z));
  return spots.find(s => fitsAt(layout, s.item, room))?.item ?? null;
}

/** What dropping an item does to the layout (see planDrop). */
export interface DropPlan {
  /** The layout after the drop. */
  items: RoomItem[];
  /** The dropped item, where it landed. */
  placed: RoomItem;
  /** The items that were in the way, where they were moved to. */
  moved: RoomItem[];
}

/**
 * Drop `candidate` (an item already anchored on its target cell) into the layout, like a
 * home-screen widget: solid items it lands on slide to the nearest spot they fit, keeping
 * their facing. `lifted` is the placed item being dragged, which leaves its old spot (a
 * new copy from the inventory has none). Null when the candidate doesn't fit on its
 * surface, or something in the way has nowhere to go.
 */
export function planDrop(
  items: readonly RoomItem[],
  candidate: RoomItem,
  room: EditRoom,
  lifted: RoomItem | null,
): DropPlan | null {
  const base = lifted ? items.filter(ri => ri !== lifted) : [...items];
  // Bounds only: with nothing else in the room, it fits wherever it's inside its surface.
  if (!fitsAt([], candidate, room)) return null;
  const inWay = candidate.itemId.isOverlappable
    ? []
    : base.filter(ri => !ri.itemId.isOverlappable && overlaps(ri, candidate));
  if (inWay.length === 0) return { items: [...base, candidate], placed: candidate, moved: [] };

  // The biggest go first: they are the hardest to fit.
  const area = (ri: RoomItem) => ri.itemId.dimensions.x * ri.itemId.dimensions.y * Math.max(1, ri.itemId.dimensions.z);
  const layout = [...base.filter(ri => !inWay.includes(ri)), candidate];
  const movedTo = new Map<RoomItem, RoomItem>();
  for (const ri of [...inWay].sort((a, b) => area(b) - area(a))) {
    const spot = nearestFit(layout, ri, room);
    if (!spot) return null;
    layout.push(spot);
    movedTo.set(ri, spot);
  }
  // In the original order, so the layout doesn't reshuffle.
  return {
    items: [...base.map(ri => movedTo.get(ri) ?? ri), candidate],
    placed: candidate,
    moved: [...movedTo.values()],
  };
}
