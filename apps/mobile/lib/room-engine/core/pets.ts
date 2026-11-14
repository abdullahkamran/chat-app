import { getEffectiveDimensions } from '@/constants/grid';
import { Facing, isPetItem, type Dimensions, type PetKind, type RoomItem } from '@chat-app/shared-types';
import { facingFromDelta } from './facing';
import { findPath, isLineClear, smoothPath } from './usePathfinding';

/**
 * Pet behaviour: what each placed pet is doing at any moment, the same on every client.
 *
 * Nobody controls a pet and nothing about it goes over the socket. Time is cut into slots
 * of SLOT_MS on the server's clock, and each slot's activity is drawn from a random number
 * seeded by the pet's room item id and the slot number. Given the same layout, every client
 * works out the same walks, naps and meows at the same moments, whenever it joined.
 *
 * Each slot either moves (walks somewhere, or for a bird hops or flies) or stays put doing
 * one thing (sits, sleeps, grooms, barks...). Where a pet is at a slot's start is where the
 * last moving slot took it. Every FORCED_MOVE_EVERY-th slot moves to a spot that depends on
 * nothing before it, so working out any slot never looks back more than that many slots.
 *
 * Pets ignore people (they walk through them, as people walk through each other) and stay
 * on free floor that can be reached from their home, the cell they were placed on. A bird
 * may fly over furniture to any free cell. When the layout changes, every client recomputes
 * from the new one, so the pet may hop to a new spot, but everyone sees the same hop.
 */

export const SLOT_MS = 7000;
const FORCED_MOVE_EVERY = 6;
/** Slots computed around now: one back (a walk still finishing) and a few ahead. */
const SLOTS_BEHIND = 1;
const SLOTS_AHEAD = 3;
/** A walk never takes the whole slot: it starts after up to this long, and ends this long before the slot does. */
const MAX_START_DELAY_MS = 1500;
const END_MARGIN_MS = 400;

/** Clips a pet can play; each kind's rig has its own take on them (engines/skia/pets). */
export type PetClip =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'groom'
  | 'speak'
  | 'stretch'
  | 'wag'
  | 'scratch'
  | 'hop'
  | 'fly'
  | 'peck';

/** Sounds a pet makes; played by the session (session/sounds.ts). */
export type PetSound = 'meow' | 'bark' | 'chirp';

/** One stretch of a pet's timeline. Times are in server milliseconds until the session shifts them. */
export interface PetSegment {
  start: number;
  end: number;
  clip: PetClip;
  /**
   * Grid points, start first: one point when staying put, several for a walk or a flight,
   * covered at an even pace between `start` and `end`.
   */
  path: { x: number; y: number }[];
  /** Peak height of a flight's arc in grid z units; 0 on the ground. */
  arc: number;
  /** Facing while staying put. Moving pets face the way they go. */
  facing: Facing;
  /** Played as the segment starts. */
  sound?: PetSound;
}

/** A pet in the room and what it is doing around now. */
export interface PetState {
  /** The room item's id: stable while it stays placed, and the seed of its behaviour. */
  id: string;
  kind: PetKind;
  /** Whose pet it is (the room item's `placedBy`). */
  ownerId: string;
  segments: PetSegment[];
}

interface Activity {
  clip: PetClip;
  weight: number;
  /** Seconds the clip plays before going back to idle for the rest of the slot; absent fills the slot. */
  once?: number;
  sound?: PetSound;
}

interface Personality {
  /** Chance a slot moves, when not forced to. */
  move: number;
  /** Walking pace in cells per second; faster walks than RUN_OVER times this run instead. */
  walkSpeed: number;
  /** Chance a sleeping pet sleeps on through the next slot instead of doing anything else, moving included. */
  sleepOn: number;
  activities: Activity[];
  /** Birds: chance a move flies (anywhere) rather than hops (a cell or two). */
  fly?: number;
}

const RUN_OVER = 1.4;
const FLY_SPEED = 4;
const FLY_ARC = 1.6;
const HOP_SPEED = 1.5;
const HOP_RANGE = 2;

const PERSONALITIES: Record<PetKind, Personality> = {
  cat: {
    move: 0.25,
    walkSpeed: 1.4,
    sleepOn: 0.75,
    activities: [
      { clip: 'idle', weight: 2 },
      { clip: 'sit', weight: 3 },
      { clip: 'sleep', weight: 3 },
      { clip: 'groom', weight: 2.5 },
      { clip: 'speak', weight: 1.5, once: 1.2, sound: 'meow' },
      { clip: 'stretch', weight: 1, once: 2 },
    ],
  },
  dog: {
    move: 0.45,
    walkSpeed: 1.8,
    sleepOn: 0.6,
    activities: [
      { clip: 'idle', weight: 2 },
      { clip: 'sit', weight: 3 },
      { clip: 'sleep', weight: 2 },
      { clip: 'wag', weight: 2.5 },
      { clip: 'speak', weight: 1.5, once: 1.2, sound: 'bark' },
      { clip: 'scratch', weight: 1, once: 2 },
    ],
  },
  bird: {
    move: 0.5,
    walkSpeed: HOP_SPEED,
    sleepOn: 0.5,
    fly: 0.55,
    activities: [
      { clip: 'idle', weight: 2 },
      { clip: 'peck', weight: 3 },
      { clip: 'groom', weight: 2 },
      { clip: 'speak', weight: 2, once: 1.2, sound: 'chirp' },
      { clip: 'sleep', weight: 1 },
    ],
  },
};

const FACINGS: Facing[] = [Facing.SE, Facing.SW, Facing.NE, Facing.NW];

// ── Seeded randomness ─────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) fixed by the pet, the slot and what it is for (`salt`). */
function rand(seed: number, slot: number, salt: number): number {
  let t = (seed ^ Math.imul(slot, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  // mulberry32, one step
  t = (t + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

const SALT = { move: 1, target: 2, target2: 3, activity: 4, sleepOn: 5, delay: 6, fly: 7, turn: 8, facing: 9 };

// ── The floor ─────────────────────────────────────────────────────────────────

interface Floor {
  isWalkable(gx: number, gy: number): boolean;
  /** Free cells reachable from home, in a fixed order. */
  reachable: { x: number; y: number }[];
  /** Every free cell (birds fly over furniture), in a fixed order. */
  free: { x: number; y: number }[];
  /** Where the pet lives: its placed cell, or the nearest reachable free cell to it. */
  home: { x: number; y: number };
}

/** Cells solid items cover; pets and overlappable items never block. */
function blockedCells(items: RoomItem[]): Set<string> {
  const blocked = new Set<string>();
  for (const ri of items) {
    if (ri.itemId.isOverlappable || isPetItem(ri.itemId)) continue;
    const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
    for (let dx = 0; dx < dims.x; dx++) {
      for (let dy = 0; dy < dims.y; dy++) blocked.add(`${ri.position.x + dx},${ri.position.y + dy}`);
    }
  }
  return blocked;
}

function makeFloor(dimensions: Dimensions, blocked: Set<string>, placedAt: { x: number; y: number }): Floor {
  const isWalkable = (gx: number, gy: number) =>
    gx >= 0 && gy >= 0 && gx < dimensions.x && gy < dimensions.y && !blocked.has(`${gx},${gy}`);

  const free: { x: number; y: number }[] = [];
  for (let x = 0; x < dimensions.x; x++) {
    for (let y = 0; y < dimensions.y; y++) if (isWalkable(x, y)) free.push({ x, y });
  }
  const px = Math.round(placedAt.x);
  const py = Math.round(placedAt.y);
  let home = { x: px, y: py };
  if (!isWalkable(px, py) && free.length) {
    home = free.reduce((best, c) => (dist2(c, { x: px, y: py }) < dist2(best, { x: px, y: py }) ? c : best));
  }

  // Flood fill from home (four ways is enough to tell what's cut off).
  const reachable: { x: number; y: number }[] = [];
  if (isWalkable(home.x, home.y)) {
    const seen = new Set([`${home.x},${home.y}`]);
    const queue = [home];
    while (queue.length) {
      const c = queue.shift()!;
      reachable.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: c.x + dx, y: c.y + dy };
        const key = `${n.x},${n.y}`;
        if (!seen.has(key) && isWalkable(n.x, n.y)) {
          seen.add(key);
          queue.push(n);
        }
      }
    }
    reachable.sort((a, b) => a.x - b.x || a.y - b.y);
  }
  return { isWalkable, reachable, free, home };
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** The way the last leg of a route points, or `fallback` for a route that goes nowhere. */
function endFacing(route: { x: number; y: number }[], fallback: Facing): Facing {
  const n = route.length;
  if (n < 2 || dist2(route[n - 2], route[n - 1]) === 0) return fallback;
  return facingFromDelta(route[n - 1].x - route[n - 2].x, route[n - 1].y - route[n - 2].y);
}

function pathLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.sqrt(dist2(points[i - 1], points[i]));
  return len;
}

// ── One pet's timeline ────────────────────────────────────────────────────────

interface SlotPlan {
  moves: boolean;
  /** Where it is when the slot ends. */
  end: { x: number; y: number };
  /** Facing when the slot ends. */
  facing: Facing;
  /** The activity of a slot that stays put. */
  activity: Activity | null;
  /** A moving slot's route (start first) and how it goes. */
  route?: { x: number; y: number }[];
  how?: 'walk' | 'hop' | 'fly';
}

class Planner {
  private plans = new Map<number, SlotPlan>();
  private readonly seed: number;
  private readonly p: Personality;

  constructor(
    id: string,
    private readonly kind: PetKind,
    private readonly floor: Floor,
  ) {
    this.seed = hashString(id);
    this.p = PERSONALITIES[kind];
  }

  private r(slot: number, salt: number) {
    return rand(this.seed, slot, salt);
  }

  private pick<T>(list: T[], slot: number, salt: number): T {
    return list[Math.floor(this.r(slot, salt) * list.length)];
  }

  /** A spot that depends only on the slot: of two random reachable cells, the one nearer home. */
  private wanderTarget(slot: number) {
    const cells = this.floor.reachable;
    const a = this.pick(cells, slot, SALT.target);
    const b = this.pick(cells, slot, SALT.target2);
    return dist2(a, this.floor.home) <= dist2(b, this.floor.home) ? a : b;
  }

  plan(slot: number): SlotPlan {
    const cached = this.plans.get(slot);
    if (cached) return cached;
    const plan = this.make(slot);
    this.plans.set(slot, plan);
    return plan;
  }

  private make(slot: number): SlotPlan {
    const { floor, p } = this;
    const forced = slot % FORCED_MOVE_EVERY === 0;

    // Nowhere to go (boxed in by furniture): stay at home and idle.
    if (!floor.reachable.length) {
      return { moves: false, end: floor.home, facing: Facing.SE, activity: p.activities[0] };
    }

    if (forced) {
      // Where it sets out from depends on the slots before, and planning that route here would
      // chain back through every forced slot. So the route waits for segments(), and the facing
      // the next slots start from is a turn of its own once it arrives.
      const to = this.wanderTarget(slot);
      const facing = this.pick(FACINGS, slot, SALT.facing);
      return { moves: true, end: to, facing, activity: null, how: this.kind === 'bird' ? 'fly' : 'walk' };
    }

    const prev = this.plan(slot - 1);
    const from = prev.end;
    const sleeping = prev.activity?.clip === 'sleep' && this.r(slot, SALT.sleepOn) < p.sleepOn;
    if (sleeping) return { moves: false, end: from, facing: prev.facing, activity: prev.activity };

    if (this.r(slot, SALT.move) < p.move) {
      let to = this.wanderTarget(slot);
      let how: SlotPlan['how'] = 'walk';
      if (this.kind === 'bird') {
        if (this.r(slot, SALT.fly) < (p.fly ?? 0)) {
          to = this.pick(floor.free, slot, SALT.target);
          how = 'fly';
        } else {
          const near = floor.reachable.filter(c => Math.abs(c.x - from.x) <= HOP_RANGE && Math.abs(c.y - from.y) <= HOP_RANGE);
          to = near.length ? this.pick(near, slot, SALT.target) : from;
          how = 'hop';
        }
      }
      const route = this.routeBetween(from, to, how);
      return { moves: true, end: to, facing: endFacing(route, prev.facing), activity: null, route, how };
    }

    const total = p.activities.reduce((sum, a) => sum + a.weight, 0);
    let roll = this.r(slot, SALT.activity) * total;
    const activity = p.activities.find(a => (roll -= a.weight) < 0) ?? p.activities[0];
    const turn = this.r(slot, SALT.turn) < 0.35;
    const facing = turn ? this.pick(FACINGS, slot, SALT.facing) : prev.facing;
    return { moves: false, end: from, facing, activity };
  }

  /** Straight when nothing is in the way (or flying), else around furniture. Start first. */
  private routeBetween(from: { x: number; y: number }, to: { x: number; y: number }, how: SlotPlan['how']) {
    if (how === 'fly' || (from.x === to.x && from.y === to.y)) return [from, to];
    const isWalkable = this.floor.isWalkable;
    const a = { gx: from.x, gy: from.y };
    const b = { gx: to.x, gy: to.y };
    if (isLineClear(a, b, isWalkable)) return [from, to];
    const cells = findPath(a, b, isWalkable);
    return cells.length ? [from, ...smoothPath(a, cells, isWalkable).map(c => ({ x: c.gx, y: c.gy }))] : [from, to];
  }

  segments(slot: number): PetSegment[] {
    const plan = this.plan(slot);
    const start = slot * SLOT_MS;
    const end = start + SLOT_MS;
    if (!plan.moves) {
      const at = [plan.end];
      const a = plan.activity!;
      if (a.once === undefined) return [{ start, end, clip: a.clip, path: at, arc: 0, facing: plan.facing }];
      const mid = start + a.once * 1000;
      return [
        { start, end: mid, clip: a.clip, path: at, arc: 0, facing: plan.facing, sound: a.sound },
        { start: mid, end, clip: 'idle', path: at, arc: 0, facing: plan.facing },
      ];
    }

    const startFacing = this.plan(slot - 1).facing;
    const route = plan.route ?? this.routeBetween(this.plan(slot - 1).end, plan.end, plan.how);
    const facing = endFacing(route, startFacing);
    const len = pathLength(route);
    const from = route[0];
    if (len === 0) return [{ start, end, clip: 'idle', path: [from], arc: 0, facing }];

    const how = plan.how ?? 'walk';
    const speed = how === 'fly' ? FLY_SPEED : this.p.walkSpeed;
    const delay = this.r(slot, SALT.delay) * MAX_START_DELAY_MS;
    const room = SLOT_MS - delay - END_MARGIN_MS;
    // A far walk runs, or just goes faster, so it always ends inside its slot.
    const wanted = (len / speed) * 1000;
    const moveMs = Math.min(wanted, room);
    const pace = len / (moveMs / 1000);
    const clip: PetClip = how === 'fly' ? 'fly' : how === 'hop' ? 'hop' : pace > speed * RUN_OVER ? 'run' : 'walk';
    const moveStart = start + delay;
    const moveEnd = moveStart + moveMs;
    return [
      { start, end: moveStart, clip: 'idle', path: [from], arc: 0, facing: startFacing },
      { start: moveStart, end: moveEnd, clip, path: route, arc: how === 'fly' ? FLY_ARC : 0, facing, sound: how === 'fly' ? 'chirp' : undefined },
      { start: moveEnd, end, clip: 'idle', path: [route[route.length - 1]], arc: 0, facing },
    ];
  }
}

/**
 * Every pet in the layout and what it does from one slot before `serverNow` to a few after.
 * Pure: the same items, room size and time give the same answer on every client.
 */
export function petTimelines(items: RoomItem[], dimensions: Dimensions, serverNow: number): PetState[] {
  const pets = items.filter(ri => ri.itemId.pet && ri._id);
  if (!pets.length) return [];
  const blocked = blockedCells(items);
  const slot = Math.floor(serverNow / SLOT_MS);
  return pets.map(ri => {
    const floor = makeFloor(dimensions, blocked, ri.position);
    const planner = new Planner(ri._id!, ri.itemId.pet!.kind, floor);
    const segments: PetSegment[] = [];
    for (let s = slot - SLOTS_BEHIND; s <= slot + SLOTS_AHEAD; s++) segments.push(...planner.segments(s));
    return { id: ri._id!, kind: ri.itemId.pet!.kind, ownerId: String(ri.placedBy ?? ''), segments };
  });
}
