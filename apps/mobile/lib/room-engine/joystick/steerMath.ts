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
 * Whether the body may stand at (x, y), coming from (fx, fy): every cell it would overlap
 * is free or already overlapped. The second part lets it step out of furniture it sits in.
 * Cells are centred on grid vertices, so a point's cell is its rounded position.
 */
function fits(grid: SteerGrid, fx: number, fy: number, x: number, y: number): boolean {
  'worklet';
  const r = STEER_BODY_RADIUS;
  for (let cx = Math.round(x - r); cx <= Math.round(x + r); cx++) {
    for (let cy = Math.round(y - r); cy <= Math.round(y + r); cy++) {
      if (!cellBlocked(grid, cx, cy)) continue;
      const already = cx >= Math.round(fx - r) && cx <= Math.round(fx + r)
        && cy >= Math.round(fy - r) && cy <= Math.round(fy + r);
      if (!already) return false;
    }
  }
  return true;
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
  if (fits(grid, x, y, nx, ny)) return { x: nx, y: ny };
  if (fits(grid, x, y, nx, y)) return { x: nx, y };
  if (fits(grid, x, y, x, ny)) return { x, y: ny };
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
