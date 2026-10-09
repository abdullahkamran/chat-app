import { Orientiation, type Dimensions } from '@chat-app/shared-types';

/** Width of one isometric floor tile in pixels. */
export const TILE_W = 80;
/** Height of one isometric floor tile in pixels. TILE_W/2 = classic 2:1 isometric (YoWorld-style). */
export const TILE_H = 40;
/** Pixel height reserved for the walls above the floor. */
export const WALL_HEIGHT = 200;

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
 * Grid origin (0,0) is the back-left corner where both walls meet.
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
 * Compute the origin (pixel position of grid cell 0,0) so the room is
 * centered horizontally within the canvas, with the floor starting at WALL_HEIGHT.
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
  return { x: originX, y: WALL_HEIGHT };
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
 * Depth-sort key for the painter's algorithm.
 * Objects with a higher sum render in front of those with a lower sum.
 */
export function depthKey(gx: number, gy: number): number {
  return gx + gy;
}
