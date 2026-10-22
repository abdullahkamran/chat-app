import type { ActorAction, RoomOccupant } from '@chat-app/shared-types';

export type SitAction = Extract<ActorAction, { kind: 'sit' }>;
export type EmoteAction = Extract<ActorAction, { kind: 'emote' }>;

/** Emotes older than this are left out of snapshots. Every emote clip is shorter. */
const EMOTE_SNAPSHOT_MS = 10_000;
/** Messages older than this are dropped; a chat bubble shows for 3.5 s by default. */
const BUBBLE_SNAPSHOT_MS = 10_000;
/** Most messages kept per user, for someone sending several in a row. */
const BUBBLE_SNAPSHOT_MAX = 5;

export interface Presence {
    /** The socket that entered. Only it may change or remove the entry. */
    socketId: string;
    /** The last point the user walked to. Absent until they first move: they are at the entry door. */
    position?: { x: number; y: number };
    /** The seat they sit on or are walking to. */
    sit?: SitAction;
    /** The last emote they played, while standing. */
    emote?: { animation: string; startedAt: number };
    /** Recent chat messages, oldest first, so a newcomer sees bubbles still on screen. */
    messages?: { text: string; sentAt: number }[];
}

/**
 * Who is in each room and what they are doing, so a newcomer can be told at once instead
 * of waiting for every occupant to reply. Updated by the socket handlers alongside each relay.
 *
 * This lives in this process's memory. With several backend instances, users in one room could
 * be connected to different instances, so it would have to move to shared storage such as Redis
 * (next to the Socket.IO Redis adapter). One instance is all we run today; see docs/known-issues.md.
 */
const rooms = new Map<string, Map<string, Presence>>();

export function sameSeat(a: SitAction, b: SitAction): boolean {
    return a.itemId === b.itemId && a.at.x === b.at.x && a.at.y === b.at.y && a.seatIndex === b.seatIndex;
}

export const roomPresence = {
    /** Everyone in the room except `userId`, as a newcomer sees them. */
    snapshot(roomId: string, userId: string, now = Date.now()): RoomOccupant[] {
        const occupants: RoomOccupant[] = [];
        for (const [uid, p] of rooms.get(roomId) ?? []) {
            if (uid === userId) continue;
            const occupant: RoomOccupant = { userId: uid };
            if (p.position) occupant.position = p.position;
            if (p.sit) {
                occupant.action = p.sit;
            } else if (p.emote && now - p.emote.startedAt < EMOTE_SNAPSHOT_MS) {
                occupant.action = { kind: 'emote', animation: p.emote.animation, elapsedMs: now - p.emote.startedAt };
            }
            const bubbles = (p.messages ?? [])
                .filter(m => now - m.sentAt < BUBBLE_SNAPSHOT_MS)
                .map(m => ({ text: m.text, elapsedMs: now - m.sentAt }));
            if (bubbles.length) occupant.bubbles = bubbles;
            occupants.push(occupant);
        }
        return occupants;
    },

    /** Put a user in a room, replacing any entry left by an earlier socket of theirs. */
    enter(roomId: string, userId: string, presence: Presence): void {
        let room = rooms.get(roomId);
        if (!room) {
            room = new Map();
            rooms.set(roomId, room);
        }
        room.set(userId, presence);
    },

    /** The user's entry, if this socket owns it. */
    own(roomId: string, userId: string, socketId: string): Presence | undefined {
        const p = rooms.get(roomId)?.get(userId);
        return p?.socketId === socketId ? p : undefined;
    },

    /** Remember a chat message, dropping ones too old or too many to still be on screen. */
    addMessage(presence: Presence, text: string, now = Date.now()): void {
        const recent = (presence.messages ?? []).filter(m => now - m.sentAt < BUBBLE_SNAPSHOT_MS);
        recent.push({ text, sentAt: now });
        presence.messages = recent.slice(-BUBBLE_SNAPSHOT_MAX);
    },

    /** Who holds a seat (sitting on it or walking to it), if anyone. */
    seatHolder(roomId: string, seat: SitAction): string | undefined {
        for (const [uid, p] of rooms.get(roomId) ?? []) {
            if (p.sit && sameSeat(p.sit, seat)) return uid;
        }
        return undefined;
    },

    /**
     * Remove the user if this socket owns their entry. False when they re-entered from
     * another socket since (a reconnect whose old socket only now timed out), so they stay.
     */
    leave(roomId: string, userId: string, socketId: string): boolean {
        const room = rooms.get(roomId);
        if (room?.get(userId)?.socketId !== socketId) return false;
        room.delete(userId);
        if (room.size === 0) rooms.delete(roomId);
        return true;
    },
};
