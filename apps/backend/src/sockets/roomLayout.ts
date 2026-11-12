import mongoose from 'mongoose';
import { MUTUAL_EMOTE_GAP, Orientiation, entryDoorOf } from '@chat-app/shared-types';
import Item from '../models/item.model';
import Room, { type IRoom } from '../models/room.model';

/** What placement needs from a saved room: its floor size, entry door and solid furniture. */
export interface RoomLayout {
    dimensions: { x: number; y: number };
    door: { x: number; y: number };
    items: {
        position: { x: number; y: number };
        orientation: string;
        dimensions: { x: number; y: number };
        isOverlappable: boolean;
    }[];
}

type Cell = { x: number; y: number };

const key = (c: Cell) => `${c.x},${c.y}`;

/**
 * Cells covered by solid furniture. Mirrors the client's walkability grid
 * (apps/mobile/lib/room-engine/core/useWalkabilityGrid.ts): a footprint runs from the item's
 * position along +x and +y, with x and y swapped for NINETY / TWO_SEVENTY.
 */
export function blockedCells(layout: RoomLayout): Set<string> {
    const blocked = new Set<string>();
    for (const item of layout.items) {
        if (item.isOverlappable) continue;
        const swap = item.orientation === Orientiation.NINETY || item.orientation === Orientiation.TWO_SEVENTY;
        const w = swap ? item.dimensions.y : item.dimensions.x;
        const d = swap ? item.dimensions.x : item.dimensions.y;
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < d; dy++) blocked.add(key({ x: item.position.x + dx, y: item.position.y + dy }));
        }
    }
    return blocked;
}

/** The cell a floor point belongs to: cells are centred on grid vertices, as on the client. */
export function cellOf(p: Cell, layout: RoomLayout): Cell {
    return {
        x: Math.max(0, Math.min(layout.dimensions.x - 1, Math.round(p.x))),
        y: Math.max(0, Math.min(layout.dimensions.y - 1, Math.round(p.y))),
    };
}

/**
 * The free cell nearest `from` in steps (breadth-first, so ties go the same way every time),
 * skipping `blocked` and `taken`. Null when the floor is full.
 */
export function nearestFreeCell(from: Cell, layout: RoomLayout, blocked: Set<string>, taken: Set<string>): Cell | null {
    const seen = new Set([key(from)]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
        const c = queue[i];
        if (!blocked.has(key(c)) && !taken.has(key(c))) return c;
        for (const n of [{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }]) {
            if (n.x < 0 || n.y < 0 || n.x >= layout.dimensions.x || n.y >= layout.dimensions.y || seen.has(key(n))) continue;
            seen.add(key(n));
            queue.push(n);
        }
    }
    return null;
}

/** A saved room's layout, built from its items' footprints. */
export async function roomLayoutOf(room: Pick<IRoom, 'dimensions' | 'doors' | 'items'>): Promise<RoomLayout> {
    const defs = await Item.find({ _id: { $in: room.items.map(i => i.itemId) } }).select('dimensions isOverlappable');
    const byId = new Map(defs.map(d => [d._id.toString(), d]));
    const door = entryDoorOf(room.doors).position;
    return {
        dimensions: room.dimensions,
        door: { x: door.x, y: door.y },
        items: room.items.flatMap(i => {
            const def = byId.get(i.itemId.toString());
            return def
                ? [{ position: i.position, orientation: i.orientation, dimensions: def.dimensions, isOverlappable: def.isOverlappable }]
                : [];
        }),
    };
}

/** The layout of the room with this id, or null when there is no such room. */
export async function loadRoomLayout(roomId: string): Promise<RoomLayout | null> {
    if (!mongoose.isValidObjectId(roomId)) return null;
    const room = await Room.findById(roomId).select('dimensions doors items');
    return room ? roomLayoutOf(room) : null;
}

/**
 * Where the initiator of a mutual emote stands: MUTUAL_EMOTE_GAP cells from the target along
 * one grid axis, so the two face each other squarely (SE and NW, or SW and NE). Of the four
 * sides, the one nearest the initiator whose cell is free floor. Null when all four are
 * blocked or off the floor.
 */
export function mutualEmoteSpot(target: Cell, initiator: Cell, layout: RoomLayout): Cell | null {
    const blocked = blockedCells(layout);
    const sides = [
        { x: target.x + MUTUAL_EMOTE_GAP, y: target.y },
        { x: target.x - MUTUAL_EMOTE_GAP, y: target.y },
        { x: target.x, y: target.y + MUTUAL_EMOTE_GAP },
        { x: target.x, y: target.y - MUTUAL_EMOTE_GAP },
    ].filter(p => {
        const c = { x: Math.round(p.x), y: Math.round(p.y) };
        const onFloor = p.x >= 0 && p.y >= 0 && p.x <= layout.dimensions.x && p.y <= layout.dimensions.y
            && c.x < layout.dimensions.x && c.y < layout.dimensions.y;
        return onFloor && !blocked.has(key(c));
    });
    if (sides.length === 0) return null;
    const distance = (p: Cell) => Math.hypot(p.x - initiator.x, p.y - initiator.y);
    return sides.reduce((best, p) => (distance(p) < distance(best) ? p : best));
}
