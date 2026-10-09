import { type GridPoint } from '@/constants/grid';

/**
 * A* pathfinding on a 2D grid with 8-directional (diagonal) movement.
 *
 * Returns the list of grid cells to walk through (excluding the start cell,
 * including the destination), or an empty array if unreachable.
 */
export function findPath(
  from: GridPoint,
  to: GridPoint,
  isWalkable: (gx: number, gy: number) => boolean,
): GridPoint[] {
  if (!isWalkable(to.gx, to.gy)) return [];
  if (from.gx === to.gx && from.gy === to.gy) return [];

  type Node = {
    gx: number;
    gy: number;
    g: number; // cost from start
    f: number; // g + heuristic
    parent: Node | null;
  };

  const key = (gx: number, gy: number) => `${gx},${gy}`;

  const open: Node[] = [];
  const closed = new Set<string>();
  const openMap = new Map<string, Node>();

  const startNode: Node = {
    gx: from.gx,
    gy: from.gy,
    g: 0,
    f: heuristic(from.gx, from.gy, to.gx, to.gy),
    parent: null,
  };
  open.push(startNode);
  openMap.set(key(startNode.gx, startNode.gy), startNode);

  while (open.length > 0) {
    let lowestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[lowestIdx].f) lowestIdx = i;
    }
    const current = open.splice(lowestIdx, 1)[0];
    openMap.delete(key(current.gx, current.gy));
    closed.add(key(current.gx, current.gy));

    if (current.gx === to.gx && current.gy === to.gy) {
      return reconstructPath(current);
    }

    for (const [nx, ny, cost] of neighbors(current.gx, current.gy)) {
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (!isWalkable(nx, ny) && !(nx === to.gx && ny === to.gy)) continue;

      const g = current.g + cost;
      const existing = openMap.get(nk);

      if (!existing) {
        const node: Node = {
          gx: nx,
          gy: ny,
          g,
          f: g + heuristic(nx, ny, to.gx, to.gy),
          parent: current,
        };
        open.push(node);
        openMap.set(nk, node);
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + heuristic(nx, ny, to.gx, to.gy);
        existing.parent = current;
      }
    }
  }

  return [];
}

/**
 * Check if a straight line from `from` to `to` passes through no blocked cells.
 * Destination cell is always considered passable (handled by caller).
 */
export function isLineClear(
  from: GridPoint,
  to: GridPoint,
  isWalkable: (gx: number, gy: number) => boolean,
): boolean {
  const dx = to.gx - from.gx;
  const dy = to.gy - from.gy;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2);
  if (steps === 0) return true;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const gx = Math.round(from.gx + dx * t);
    const gy = Math.round(from.gy + dy * t);
    // Always allow the destination through even if it's the only walkable cell
    if (gx === to.gx && gy === to.gy) continue;
    if (!isWalkable(gx, gy)) return false;
  }
  return true;
}

/**
 * String-pull / path smoothing: replace runs of grid cells with direct
 * line segments where no obstacle intervenes.
 *
 * A path of 8 zig-zagging cells around a corner becomes 2–3 waypoints,
 * allowing the character to glide in straight-line segments.
 */
export function smoothPath(
  from: GridPoint,
  path: GridPoint[],
  isWalkable: (gx: number, gy: number) => boolean,
): GridPoint[] {
  if (path.length <= 1) return path;

  const result: GridPoint[] = [];
  let current = from;
  let i = 0;

  while (i < path.length) {
    // Find the furthest waypoint reachable via unobstructed straight line
    let furthest = i;
    for (let j = path.length - 1; j > i; j--) {
      if (isLineClear(current, path[j], isWalkable)) {
        furthest = j;
        break;
      }
    }
    result.push(path[furthest]);
    current = path[furthest];
    i = furthest + 1;
  }

  return result;
}

// Octile distance heuristic — admissible for 8-directional grids
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

// 8 neighbors: 4 cardinal + 4 diagonal (diagonal cost = √2)
function neighbors(gx: number, gy: number): [number, number, number][] {
  return [
    [gx + 1, gy,     1],
    [gx - 1, gy,     1],
    [gx,     gy + 1, 1],
    [gx,     gy - 1, 1],
    [gx + 1, gy + 1, Math.SQRT2],
    [gx + 1, gy - 1, Math.SQRT2],
    [gx - 1, gy + 1, Math.SQRT2],
    [gx - 1, gy - 1, Math.SQRT2],
  ];
}

function reconstructPath(node: { gx: number; gy: number; parent: { gx: number; gy: number; parent: any } | null }): GridPoint[] {
  const path: GridPoint[] = [];
  let current: typeof node | null = node;
  while (current?.parent) {
    path.unshift({ gx: current.gx, gy: current.gy });
    current = current.parent;
  }
  return path;
}
