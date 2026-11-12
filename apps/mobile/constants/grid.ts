import { Orientiation, type Dimensions } from '@chat-app/shared-types';

/** Width of one isometric floor tile in pixels. */
export const TILE_W = 80;
/** Height of one isometric floor tile in pixels. TILE_W/2 = classic 2:1 isometric (YoWorld-style). */
export const TILE_H = 40;
/** Pixel height reserved for the walls above the floor. */
export const WALL_HEIGHT = 200;
/** Rows of wall cells, each one grid unit (TILE_H) of height. */
export const WALL_ROWS = WALL_HEIGHT / TILE_H;
/**
 * Texture pixels per cell side for floorings and wallpapers. Both are flat, seamless images
 * that tile in x and y: a floor cell and a wall cell (TILE_W/2 wide, TILE_H tall) are squares
 * before projection, so a 1280 px texture spans 10 cells on either. 128 keeps them sharp
 * on 3x screens (a floor cell is 80 pt across). Matches TEXTURE_PX_PER_CELL in
 * apps/backend/scripts/item-placeholders.ts.
 */
export const TEXTURE_PX_PER_CELL = 128;

/**
 * The two walls. The right wall stands on the floor's back edge along the x axis
 * (gy = -0.5), the left one along the y axis (gx = -0.5).
 */
export type WallSide = 'left' | 'right';

/**
 * One wall cell: `col` cells along the wall from the corner where the walls meet, `row`
 * grid units up from the floor. Right-wall column c sits behind floor column gx = c,
 * left-wall column c behind floor row gy = c.
 */
export interface WallCell {
  wall: WallSide;
  col: number;
  row: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GridPoint {
  gx: number;
  gy: number;
}

export interface GridOrigin {
  x: number;
  y: number;
}

/**
 * Convert grid coordinates to absolute screen pixels.
 *
 * Grid point (0,0) is the centre of the back cell; the walls meet half a cell behind it.
 * x-axis goes right-forward, y-axis goes left-forward (standard 2:1 isometric).
 * gz shifts the point upward (for wall-mounted items).
 * A worklet, so engines can project on the UI thread.
 */
export function gridToScreen(
  gx: number,
  gy: number,
  gz: number,
  origin: GridOrigin,
): ScreenPoint {
  'worklet';
  return {
    x: origin.x + (gx - gy) * (TILE_W / 2),
    y: origin.y + (gx + gy) * (TILE_H / 2) - gz * TILE_H,
  };
}

/**
 * Convert a screen tap position to the nearest grid cell on the floor (gz=0).
 * Returns fractional values — floor/round at the call site.
 */
export function screenToGrid(
  sx: number,
  sy: number,
  origin: GridOrigin,
): GridPoint {
  'worklet';
  const dx = sx - origin.x;
  const dy = sy - origin.y;
  return {
    gx: dx / TILE_W + dy / TILE_H,
    gy: dy / TILE_H - dx / TILE_W,
  };
}

/**
 * Compute the origin (pixel position of grid point 0,0) so the room is
 * centered horizontally within the canvas, with the floor starting at WALL_HEIGHT.
 *
 * Cells are centred on grid points: cell (gx, gy) spans gx ± 0.5, gy ± 0.5, so the
 * floor spans -0.5 to size - 0.5 on each axis and its back corner, where the walls
 * meet, is (-0.5, -0.5) (see roomCorner). The origin sits half a tile below it.
 *
 * @param canvasWidth  Total canvas width in px
 * @param roomDims     Room grid dimensions (x = cols, y = rows)
 */
export function computeOrigin(
  canvasWidth: number,
  roomDims: Pick<Dimensions, 'x' | 'y'>,
): GridOrigin {
  // The floor diamond spans from left corner to right corner:
  //   leftmost x  = origin.x - roomDims.y * (TILE_W/2)
  //   rightmost x = origin.x + roomDims.x * (TILE_W/2)
  // Centre = origin.x + (roomDims.x - roomDims.y) * TILE_W/4
  // We want that centre to equal canvasWidth/2:
  const originX = canvasWidth / 2 - ((roomDims.x - roomDims.y) * TILE_W) / 4;
  return { x: originX, y: WALL_HEIGHT + TILE_H / 2 };
}

/** Screen position of the floor's back corner, where the two walls meet (grid -0.5, -0.5). */
export function roomCorner(origin: GridOrigin): ScreenPoint {
  return gridToScreen(-0.5, -0.5, 0, origin);
}

/**
 * Return the effective {x, y, z} footprint of an item after applying orientation.
 * NINETY / TWO_SEVENTY swap x and y.
 */
export function getEffectiveDimensions(
  dims: Dimensions,
  orientation: Orientiation,
): Dimensions {
  if (
    orientation === Orientiation.NINETY ||
    orientation === Orientiation.TWO_SEVENTY
  ) {
    return { x: dims.y, y: dims.x, z: dims.z };
  }
  return dims;
}

/**
 * Whether an item's art is drawn flipped left-to-right. Items have one view, so NINETY /
 * TWO_SEVENTY mirror it about the item's anchor, which swaps the grid x and y axes, as
 * getEffectiveDimensions does for the footprint. ONE_EIGHTY draws as ZERO until items
 * have back views.
 */
export function isMirrored(orientation: Orientiation): boolean {
  return orientation === Orientiation.NINETY || orientation === Orientiation.TWO_SEVENTY;
}

/**
 * The wall a wall item hangs on. Its art is drawn for the right wall, and mirroring it
 * swaps the x and y axes, which puts it on the left one. A right-wall item sits at
 * (col, 0, row), a left-wall one at (0, col, row), so itemRect fits its art to the wall.
 */
export function wallSideOf(orientation: Orientiation): WallSide {
  return isMirrored(orientation) ? 'left' : 'right';
}

/**
 * Depth-sort key for the painter's algorithm.
 * Objects with a higher sum render in front of those with a lower sum.
 */
export function depthKey(gx: number, gy: number): number {
  return gx + gy;
}
