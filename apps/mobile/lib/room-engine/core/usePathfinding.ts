import { type GridPoint } from '@/constants/grid';

type IsWalkable = (gx: number, gy: number) => boolean;

/**
 * A* pathfinding on a 2D grid with 8-directional (diagonal) movement.
 * A diagonal step needs both cells beside it free, so paths never cut a blocked corner.
 *
 * Returns the list of grid cells to walk through (excluding the start cell,
 * including the destination), or an empty array if unreachable.
 */
export function findPath(
  from: GridPoint,
  to: GridPoint,
  isWalkable: IsWalkable,
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

    for (const [nx, ny, cost] of steps(current.gx, current.gy, isWalkable)) {
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

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
 * The walkable cell reachable from `from` that is nearest `to`: `to` itself when it can be
 * reached, else the closest one (fewest steps on a tie). `from` when nothing else is reachable.
 * The start cell may be blocked (someone inside furniture), so they can still walk out.
 */
export function nearestReachableCell(from: GridPoint, to: GridPoint, isWalkable: IsWalkable): GridPoint {
  const seen = new Set([`${from.gx},${from.gy}`]);
  const queue = [from];
  let best = from;
  let bestDist = distSq(from, to);
  // Breadth-first, so among equally near cells the first found is the fewest steps away.
  for (let i = 0; i < queue.length && bestDist > 0; i++) {
    const cell = queue[i];
    for (const [gx, gy] of steps(cell.gx, cell.gy, isWalkable)) {
      const k = `${gx},${gy}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const next = { gx, gy };
      const d = distSq(next, to);
      if (d < bestDist) {
        best = next;
        bestDist = d;
      }
      queue.push(next);
    }
  }
  return best;
}

/**
 * Whether the straight segment from `from` to `to` (fractional grid points) crosses only
 * walkable cells. Visits every cell the segment touches; one that passes exactly through
 * a corner needs both cells beside the corner free, like a diagonal step. The start cell
 * is not checked, so an actor standing inside furniture can walk out.
 *
 * Cells are centred on grid vertices: cell (gx, gy) spans gx ± 0.5, gy ± 0.5.
 */
export function isLineClear(
  from: GridPoint,
  to: GridPoint,
  isWalkable: IsWalkable,
): boolean {
  // Shift by half a cell so cell edges fall on integers.
  const x0 = from.gx + 0.5;
  const y0 = from.gy + 0.5;
  const dx = to.gx - from.gx;
  const dy = to.gy - from.gy;
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(to.gx + 0.5);
  const ey = Math.floor(to.gy + 0.5);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  // Amanatides–Woo: t is the fraction of the segment travelled when it next crosses an x or y edge.
  const tDeltaX = sx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = sy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = sx > 0 ? (cx + 1 - x0) / dx : sx < 0 ? (cx - x0) / dx : Infinity;
  let tMaxY = sy > 0 ? (cy + 1 - y0) / dy : sy < 0 ? (cy - y0) / dy : Infinity;

  // Bounded, so float error can never loop forever.
  for (let n = Math.abs(ex - cx) + Math.abs(ey - cy); n > 0 && (cx !== ex || cy !== ey); n--) {
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      if (!isWalkable(cx + sx, cy) || !isWalkable(cx, cy + sy)) return false;
      cx += sx;
      cy += sy;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
      n--;
    } else if (tMaxX < tMaxY) {
      cx += sx;
      tMaxX += tDeltaX;
    } else {
      cy += sy;
      tMaxY += tDeltaY;
    }
    if (!isWalkable(cx, cy)) return false;
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
  isWalkable: IsWalkable,
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

function distSq(a: GridPoint, b: GridPoint): number {
  return (a.gx - b.gx) ** 2 + (a.gy - b.gy) ** 2;
}

const DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Walkable neighbours of a cell with their cost (diagonal √2). A diagonal step needs
 * both cells beside it free, so nobody squeezes between two pieces of furniture.
 */
function steps(gx: number, gy: number, isWalkable: IsWalkable): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [dx, dy] of DIRECTIONS) {
    const nx = gx + dx;
    const ny = gy + dy;
    if (!isWalkable(nx, ny)) continue;
    if (dx !== 0 && dy !== 0) {
      if (!isWalkable(gx + dx, gy) || !isWalkable(gx, gy + dy)) continue;
      out.push([nx, ny, Math.SQRT2]);
    } else {
      out.push([nx, ny, 1]);
    }
  }
  return out;
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
