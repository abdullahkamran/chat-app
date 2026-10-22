import type { GridPoint } from '@/constants/grid';
import { Facing, type ActorAction, type ItemSeat, type Position, type RoomItem } from '@chat-app/shared-types';

export type SitAction = Extract<ActorAction, { kind: 'sit' }>;

/** One grid step in the direction a facing looks (see facingFromDelta). */
const FACING_STEP: Record<Facing, GridPoint> = {
  [Facing.SE]: { gx: 1, gy: 0 },
  [Facing.SW]: { gx: 0, gy: 1 },
  [Facing.NE]: { gx: 0, gy: -1 },
  [Facing.NW]: { gx: -1, gy: 0 },
};

/**
 * The placed item and seat a sit action points at, or null when the item has gone.
 * Seats are taken as authored; item orientation doesn't rotate them yet, as item art
 * doesn't rotate either.
 */
export function findSeat(items: readonly RoomItem[], action: SitAction): { item: RoomItem; seat: ItemSeat } | null {
  const item = items.find(ri =>
    ri.itemId._id === action.itemId && ri.position.x === action.at.x && ri.position.y === action.at.y);
  const seat = item?.itemId.seats?.[action.seatIndex];
  return item && seat ? { item, seat } : null;
}

/** Where a seated actor's anchor goes: the cushion, lifted by the seat height. */
export function seatPosition(item: RoomItem, seat: ItemSeat): Position {
  return {
    x: item.position.x + seat.offset.x,
    y: item.position.y + seat.offset.y,
    z: seat.offset.z,
  };
}

/** The floor cell in front of a seat, where an actor stands before sitting down. */
export function seatApproach(item: RoomItem, seat: ItemSeat): GridPoint {
  const step = FACING_STEP[seat.facing];
  return { gx: item.position.x + seat.cell.x + step.gx, gy: item.position.y + seat.cell.y + step.gy };
}

export function sameSeat(a: SitAction, b: SitAction): boolean {
  return a.itemId === b.itemId && a.at.x === b.at.x && a.at.y === b.at.y && a.seatIndex === b.seatIndex;
}
