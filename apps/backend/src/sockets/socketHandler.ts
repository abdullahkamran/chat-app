import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { SocketEvent } from '@chat-app/socket-constants';
import { AnimationCategory, type RoomPresenceState } from '@chat-app/shared-types';
import Animation from '../models/animation.model';
import Room from '../models/room.model';
import User from '../models/user.model';
import { sendPushToRoom } from '../services/notification.service';
import { blockedCells, cellOf, nearestFreeCell, type RoomLayout } from './roomLayout';
import { roomPresence, type EmoteAction, type Presence, type SitAction } from './roomPresence';

/** A grid point with finite coordinates, or null. */
function parsePoint(p: unknown): { x: number; y: number } | null {
    const { x, y } = (p ?? {}) as { x?: unknown; y?: unknown };
    return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** A well-formed sit action, copied field by field so nothing else is stored or relayed. */
function parseSit(action: unknown): SitAction | null {
    const a = action as Partial<Record<string, unknown>> | null;
    if (a?.kind !== 'sit' || typeof a.itemId !== 'string' || !Number.isInteger(a.seatIndex)) return null;
    const at = parsePoint(a.at);
    return at && { kind: 'sit', itemId: a.itemId, at, seatIndex: a.seatIndex as number };
}

/**
 * Whether the room has the sit's item at the sit's cell. A client still showing an old
 * layout could otherwise claim a seat on furniture that has moved or gone.
 */
async function seatExists(roomId: string, sit: SitAction): Promise<boolean> {
    if (!mongoose.isValidObjectId(sit.itemId)) return false;
    return !!(await Room.exists({
        _id: roomId,
        items: { $elemMatch: { itemId: sit.itemId, 'position.x': sit.at.x, 'position.y': sit.at.y } },
    }));
}

/**
 * The owner saved a new layout. Everyone sitting (or walking to a seat) stands up, and no
 * one is left inside furniture. People standing on free floor stay put. The rest (sitters,
 * and anyone whose cell furniture now covers) go to their own cell (a sitter's is where the
 * seat's item stood) when it is free, else the nearest free cell, never one someone else
 * stands on, and to the door when the floor is full. The server places everyone so all
 * clients agree; the room (owner included) gets each changed position and refetches.
 */
export function announceRoomItemsChanged(io: Server, roomId: string, layout: RoomLayout): void {
    const blocked = blockedCells(layout);
    const taken = new Set<string>();
    const toPlace: [string, Presence][] = [];
    for (const [uid, p] of roomPresence.entries(roomId)) {
        const cell = cellOf(p.position ?? layout.door, layout);
        if (!p.sit && !blocked.has(`${cell.x},${cell.y}`)) taken.add(`${cell.x},${cell.y}`);
        else toPlace.push([uid, p]);
    }
    const placed: { userId: string; x: number; y: number }[] = [];
    for (const [uid, p] of toPlace) {
        const from = cellOf(p.sit?.at ?? p.position ?? layout.door, layout);
        const to = nearestFreeCell(from, layout, blocked, taken) ?? layout.door;
        taken.add(`${to.x},${to.y}`);
        p.sit = undefined;
        p.emote = undefined;
        p.position = { x: to.x, y: to.y };
        placed.push({ userId: uid, ...p.position });
    }
    console.log(SocketEvent.RECEIVE_ROOM_ITEMS_CHANGED, { roomId, placed });
    io.to(roomId).emit(SocketEvent.RECEIVE_ROOM_ITEMS_CHANGED, { roomId, placed });
}

/**
 * Actions clients may broadcast: sitting on furniture in the room, and emotes the user owns.
 * Walks are sent as points. Returns the action to relay, or null.
 */
async function allowedAction(userId: string, roomId: string, action: unknown): Promise<SitAction | EmoteAction | null> {
    const a = action as Partial<Record<string, unknown>> | null;
    if (a?.kind === 'sit') {
        const sit = parseSit(a);
        return sit && (await seatExists(roomId, sit)) ? sit : null;
    }
    if (a?.kind === 'emote' && typeof a.animation === 'string') {
        const emote = await Animation.findOne({ name: a.animation, category: AnimationCategory.EMOTE }).select('_id');
        const owned = !!emote && !!(await User.exists({ _id: userId, animations: emote._id }));
        return owned ? { kind: 'emote', animation: a.animation } : null;
    }
    return null;
}

/** Whether the user may enter the room: a member of it or its owner. */
async function canEnter(userId: string, roomId: unknown): Promise<boolean> {
    if (typeof roomId !== 'string' || !mongoose.isValidObjectId(roomId)) return false;
    return !!(await User.exists({ _id: userId, $or: [{ rooms: roomId }, { ownedRooms: roomId }] }));
}

interface ClientSocketData {
    userId: string;
    /** Looked up once at connect, so typing events can name the user without a query each. */
    username: string;
}

const handler = {
    /**
     * Connection middleware. Runs before 'connection', so the user lookup can't
     * race the client's first events (handlers attached after an await miss them).
     */
    authenticate: async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
        try {
            const userId = socket.handshake.auth.id as string;

            const user = await User.findById(new mongoose.Types.ObjectId(userId)).select('username');
            if (!user) {
                next(new Error('Unknown user'));
                return;
            }

            const data: ClientSocketData = { userId, username: user.username };
            socket.data = data;
            next();
        } catch (e) {
            console.error(e);
            next(new Error('Socket authentication failed'));
        }
    },

    clientConnected: (socket: Socket): void => {
        const { userId, username } = socket.data as ClientSocketData;

        // Rooms this socket is currently standing in (entered and not yet exited). The socket
        // is joined to exactly these channels, so it only hears the rooms it shows, and room
        // events are only relayed for them. Also used to announce an exit when the connection
        // drops without SEND_EXIT.
        const presentRoomIds = new Set<string>();

        // Entering checks membership in the DB, so handlers run one at a time in arrival order:
        // a point sent right after SEND_ENTER must not be dropped while that check is pending.
        let queue: Promise<void> = Promise.resolve();
        function inOrder<A extends unknown[]>(event: string, fn: (...args: A) => void | Promise<void>) {
            return (...args: A) => {
                queue = queue.then(() => fn(...args)).catch(e => console.error(event, e));
            };
        }
        /** Handler for an event about one room; ignored unless the socket has entered that room. */
        function inRoom<P extends { roomId: string }>(event: string, fn: (payload: P) => void | Promise<void>) {
            return inOrder(event, (payload: P) => {
                if (!presentRoomIds.has(payload?.roomId)) return;
                return fn(payload);
            });
        }

        socket.on(SocketEvent.SEND_MESSAGE, inRoom(SocketEvent.SEND_MESSAGE, ({ message, roomId }: { message: string; roomId: string }) => {
            if (typeof message !== 'string') return;
            console.log(SocketEvent.SEND_MESSAGE, { userId, roomId, message });
            const me = roomPresence.own(roomId, userId, socket.id);
            if (me) roomPresence.addMessage(me, message);
            socket.to(roomId).emit(SocketEvent.RECEIVE_MESSAGE, { roomId, userId, message });
            sendPushToRoom(roomId, userId, {
                title: 'New message',
                body: message,
                type: 'message',
            });
        }));

        // A walk to a point. Walking leaves any seat and ends any emote.
        socket.on(SocketEvent.SEND_POINT, inRoom(SocketEvent.SEND_POINT, ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
            const point = parsePoint({ x, y });
            if (!point) return;
            console.log(SocketEvent.SEND_POINT, { userId, roomId, x, y });
            const me = roomPresence.own(roomId, userId, socket.id);
            if (me) {
                me.position = point;
                me.sit = undefined;
                me.emote = undefined;
            }
            socket.to(roomId).emit(SocketEvent.RECEIVE_POINT, { roomId, userId, ...point });
        }));

        // Join the room's channel on entry rather than at connect, so rooms joined or created
        // while connected work at once, and owners (`ownedRooms`) hear their own rooms.
        // A first entry carries no state: the user appears at the entry door. A re-entry after
        // a reconnect carries where the user was, so others place them there directly.
        socket.on(SocketEvent.SEND_ENTER, inOrder(SocketEvent.SEND_ENTER, async ({ roomId, position, action }: { roomId: string } & RoomPresenceState) => {
            if (!(await canEnter(userId, roomId))) {
                console.warn(SocketEvent.SEND_ENTER, 'refused: not a member', { userId, roomId });
                return;
            }
            console.log(SocketEvent.SEND_ENTER, { userId, roomId });

            const presence: Presence = { socketId: socket.id };
            const point = parsePoint(position);
            if (point) presence.position = point;
            // A re-entry's seat may have moved or gone while the client was away; it then stands.
            const claimed = parseSit(action);
            const sit = claimed && (await seatExists(roomId, claimed)) ? claimed : null;
            const holder = sit && roomPresence.seatHolder(roomId, sit);
            if (sit && holder && holder !== userId) {
                socket.emit(SocketEvent.RECEIVE_SIT_REFUSED, { roomId, action: sit });
            } else if (sit) {
                presence.sit = sit;
            }
            const state: RoomPresenceState = {};
            if (presence.position) state.position = presence.position;
            if (presence.sit) state.action = presence.sit;

            // No await from the snapshot to the broadcast: the newcomer must not miss an event
            // that isn't in the snapshot, nor get one twice. The in-memory adapter joins at once.
            const occupants = roomPresence.snapshot(roomId, userId);
            roomPresence.enter(roomId, userId, presence);
            presentRoomIds.add(roomId);
            socket.emit(SocketEvent.RECEIVE_ROOM_PRESENCE, { roomId, occupants });
            const joined = socket.join(roomId);
            socket.to(roomId).emit(SocketEvent.RECEIVE_ENTER, { roomId, userId, ...state });
            await joined;
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone entered the room',
                type: 'enter',
            });
        }));

        socket.on(SocketEvent.SEND_EXIT, inRoom(SocketEvent.SEND_EXIT, async ({ roomId }: { roomId: string }) => {
            console.log(SocketEvent.SEND_EXIT, { userId, roomId });
            presentRoomIds.delete(roomId);
            // False when the user has since entered from another socket; they are still here.
            const left = roomPresence.leave(roomId, userId, socket.id);
            if (left) socket.to(roomId).emit(SocketEvent.RECEIVE_EXIT, { roomId, userId });
            await socket.leave(roomId);
            if (!left) return;
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone left the room',
                type: 'exit',
            });
        }));

        socket.on(SocketEvent.SEND_TYPING, inRoom(SocketEvent.SEND_TYPING, ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
            console.log(SocketEvent.SEND_TYPING, { userId, roomId, isTyping });
            socket.to(roomId).emit(SocketEvent.RECEIVE_TYPING, { roomId, userId, username, isTyping });
        }));

        // A room action other than walking (sitting, emotes). Walks still travel as SEND_POINT.
        // The server decides who gets a seat: a sit for a seat someone else holds is refused,
        // and only the sender hears about it.
        socket.on(SocketEvent.SEND_ACTION, inRoom(SocketEvent.SEND_ACTION, async ({ roomId, action }: { roomId: string; action: unknown }) => {
            const allowed = await allowedAction(userId, roomId, action);
            if (!allowed) return;
            // Nothing below awaits, so the seat check and the claim can't interleave with another sit.
            const me = roomPresence.own(roomId, userId, socket.id);
            if (allowed.kind === 'sit') {
                const holder = roomPresence.seatHolder(roomId, allowed);
                if (holder && holder !== userId) {
                    console.log(SocketEvent.SEND_ACTION, 'refused: seat taken', { userId, roomId, holder });
                    socket.emit(SocketEvent.RECEIVE_SIT_REFUSED, { roomId, action: allowed });
                    return;
                }
                if (me) {
                    me.sit = allowed;
                    me.emote = undefined;
                }
            } else if (me && !me.sit) {
                // Clients don't play emotes while seated, so neither is one recorded.
                me.emote = { animation: allowed.animation, startedAt: Date.now() };
            }
            console.log(SocketEvent.SEND_ACTION, { userId, roomId, action: allowed });
            socket.to(roomId).emit(SocketEvent.RECEIVE_ACTION, { roomId, userId, action: allowed });
        }));

        // The user saved or switched avatars. Everyone sharing a room with them refetches it.
        socket.on(SocketEvent.SEND_AVATAR_CHANGED, inOrder(SocketEvent.SEND_AVATAR_CHANGED, () => {
            for (const roomId of presentRoomIds) {
                console.log(SocketEvent.SEND_AVATAR_CHANGED, { userId, roomId });
                socket.to(roomId).emit(SocketEvent.RECEIVE_AVATAR_CHANGED, { roomId, userId });
            }
        }));

        // The app was killed, crashed or lost its connection without exiting.
        // Remove the character for everyone else. No push: flaky networks would spam it,
        // and a reconnecting client re-enters on its own. Socket.IO drops the socket's channels
        // itself. Not queued, so it runs even if a queued handler is still waiting on the DB.
        // A dead socket can time out after its client already reconnected and re-entered on a
        // new one; presence then belongs to the new socket and the user stays.
        socket.on(SocketEvent.DISCONNECT, reason => {
            for (const roomId of presentRoomIds) {
                console.log(SocketEvent.DISCONNECT, { userId, roomId, reason });
                if (roomPresence.leave(roomId, userId, socket.id)) {
                    socket.nsp.to(roomId).emit(SocketEvent.RECEIVE_EXIT, { roomId, userId });
                }
            }
            presentRoomIds.clear();
        });
    },
};

export default handler;
