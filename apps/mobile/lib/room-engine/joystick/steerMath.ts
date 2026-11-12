import { TILE_H, TILE_W } from '@/constants/grid';
import { STEER_BODY_RADIUS } from './config';

/** The stick's direction in screen space: x right, y down. (0, 0) when released or centred. */
export interface StickVector {
  x: number;
  y: number;
}

export const STICK_REST: StickVector = { x: 0, y: 0 };

/** Blocked floor cells as plain data, so worklets can read them. 1 = blocked, row-major by gy. */
export interface SteerGrid {
  w: number;
  h: number;
  blocked: number[];
}

export function makeSteerGrid(w: number, h: number, blockedCells: ReadonlySet<string>): SteerGrid {
  const blocked = new Array<number>(w * h).fill(0);
  for (const key of blockedCells) {
    const [gx, gy] = key.split(',').map(Number);
    if (gx >= 0 && gy >= 0 && gx < w && gy < h) blocked[gy * w + gx] = 1;
  }
  return { w, h, blocked };
}

/**
 * A unit grid direction for a screen direction, so pushing the stick up walks up the
 * screen. Inverts gridToScreen: a grid step moves (gx - gy) * TILE_W/2 across and
 * (gx + gy) * TILE_H/2 down. Unit length in grid cells, to match tap-to-walk's speed.
 */
export function stickToGrid(sx: number, sy: number): { dx: number; dy: number } {
  'worklet';
  const across = sx / (TILE_W / 2);
  const down = sy / (TILE_H / 2);
  const dx = (across + down) / 2;
  const dy = (down - across) / 2;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { dx: 0, dy: 0 } : { dx: dx / len, dy: dy / len };
}

function cellBlocked(grid: SteerGrid, cx: number, cy: number): boolean {
  'worklet';
  return grid.blocked[cy * grid.w + cx] === 1;
}

/**
 * Whether the body may stand at (x, y): every cell it would overlap is free.
 * Cells are centred on grid vertices, so a point's cell is its rounded position.
 */
export function fits(grid: SteerGrid, x: number, y: number): boolean {
  'worklet';
  const r = STEER_BODY_RADIUS;
  for (let cx = Math.round(x - r); cx <= Math.round(x + r); cx++) {
    for (let cy = Math.round(y - r); cy <= Math.round(y + r); cy++) {
      if (cellBlocked(grid, cx, cy)) return false;
    }
  }
  return true;
}

/** How far from (x, y) to look for floor to step off furniture onto, in cells. */
const FREE_SEARCH = 4;

/**
 * The free floor cell to step onto when the body is inside furniture (sitting on it, or
 * the furniture was placed on it): the nearest one, leaning toward the stick's direction
 * so pushing forward off a sofa steps off the front. Null when none is near.
 */
export function freeSpot(
  grid: SteerGrid,
  x: number,
  y: number,
  dir: { dx: number; dy: number },
): { x: number; y: number } | null {
  'worklet';
  const rx = Math.round(x);
  const ry = Math.round(y);
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (let cx = rx - FREE_SEARCH; cx <= rx + FREE_SEARCH; cx++) {
    for (let cy = ry - FREE_SEARCH; cy <= ry + FREE_SEARCH; cy++) {
      if (cx < 0 || cy < 0 || cx >= grid.w || cy >= grid.h || cellBlocked(grid, cx, cy)) continue;
      const ox = cx - x;
      const oy = cy - y;
      const dist = Math.hypot(ox, oy);
      const along = dist === 0 ? 0 : (ox * dir.dx + oy * dir.dy) / dist;
      const score = dist - 0.6 * along;
      if (score < bestScore) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

/** Keep the body on the floor, which spans -0.5 to size - 0.5 on each axis. */
function clampToFloor(v: number, size: number): number {
  'worklet';
  const r = STEER_BODY_RADIUS;
  return Math.min(size - 0.5 - r, Math.max(-0.5 + r, v));
}

/**
 * One move by (dx, dy) from (x, y). Blocked moves slide along the obstacle on whichever
 * axis is still free, so walking diagonally into furniture glides along its edge.
 */
export function steerStep(grid: SteerGrid, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  'worklet';
  const nx = clampToFloor(x + dx, grid.w);
  const ny = clampToFloor(y + dy, grid.h);
  if (fits(grid, nx, ny)) return { x: nx, y: ny };
  if (fits(grid, nx, y)) return { x: nx, y };
  if (fits(grid, x, ny)) return { x, y: ny };
  return { x, y };
}

/** Where `distance` cells of steering in a direction would end, in small steps so it slides like a walk. */
export function steerAhead(
  grid: SteerGrid,
  x: number,
  y: number,
  dir: { dx: number; dy: number },
  distance: number,
): { x: number; y: number } {
  'worklet';
  const steps = Math.max(1, Math.ceil(distance / 0.1));
  const d = distance / steps;
  let p = { x, y };
  for (let i = 0; i < steps; i++) p = steerStep(grid, p.x, p.y, dir.dx * d, dir.dy * d);
  return p;
}
