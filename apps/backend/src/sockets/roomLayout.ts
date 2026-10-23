import { Orientiation } from '@chat-app/shared-types';

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
