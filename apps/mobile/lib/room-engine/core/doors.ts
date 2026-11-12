import type { WallSide } from '@/constants/grid';
import type { Door } from '@chat-app/shared-types';

/**
 * Where a door stands on the walls: a door on floor column x = 0 stands on the left wall, one on
 * row y = 0 on the right (a corner door goes left). `col` is the wall column, as in WallCell,
 * so a left-wall door's column is its floor row. Null for a door away from both walls, which
 * is only marked on the floor.
 */
export function doorWallSpan(door: Door): { wall: WallSide; col: number; width: number; rows: number } | null {
  const { position: p, dimensions: d } = door;
  const rows = Math.max(1, d.z);
  if (p.x === 0) return { wall: 'left', col: p.y, width: Math.max(1, d.y), rows };
  if (p.y === 0) return { wall: 'right', col: p.x, width: Math.max(1, d.x), rows };
  return null;
}

/** Whether a door's floor cell (the one people come in on) is (gx, gy). */
export function isDoorCell(doors: readonly Door[], gx: number, gy: number): boolean {
  return doors.some(d => d.position.x === gx && d.position.y === gy);
}

/** Whether wall cells `col`..`col + width`, `row`..`row + height` on `wall` overlap a door. */
export function overlapsDoor(
  doors: readonly Door[],
  wall: WallSide,
  col: number,
  width: number,
  row: number,
  height: number,
): boolean {
  return doors.some(door => {
    const s = doorWallSpan(door);
    return !!s && s.wall === wall && col < s.col + s.width && s.col < col + width && row < s.rows && 0 < row + height;
  });
}
