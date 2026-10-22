import { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { SocketEvent } from '@chat-app/socket-constants';
import { AnimationCategory, type ActorAction } from '@chat-app/shared-types';
import Animation from '../models/animation.model';
import User from '../models/user.model';
import { sendPushToRoom } from '../services/notification.service';

/**
 * Actions clients may broadcast: sitting, and emotes the user owns. Walks are sent as points.
 */
async function mayRelay(userId: string, action: unknown): Promise<boolean> {
    const a = action as Partial<Record<string, unknown>> | null;
    if (a?.kind === 'sit') {
        const at = a.at as { x?: unknown; y?: unknown } | undefined;
        return typeof a.itemId === 'string'
            && Number.isInteger(a.seatIndex)
            && Number.isFinite(at?.x)
            && Number.isFinite(at?.y);
    }
    if (a?.kind === 'emote' && typeof a.animation === 'string') {
        const emote = await Animation.findOne({ name: a.animation, category: AnimationCategory.EMOTE }).select('_id');
        return !!emote && !!(await User.exists({ _id: userId, animations: emote._id }));
    }
    return false;
}

/** Whether the user may enter the room: a member of it or its owner. */
async function canEnter(userId: string, roomId: unknown): Promise<boolean> {
    if (typeof roomId !== 'string' || !mongoose.isValidObjectId(roomId)) return false;
    return !!(await User.exists({ _id: userId, $or: [{ rooms: roomId }, { ownedRooms: roomId }] }));
}

interface ClientSocketData {
    userId: string;
}

const handler = {
    /**
     * Connection middleware. Runs before 'connection', so the user lookup can't
     * race the client's first events (handlers attached after an await miss them).
     */
    authenticate: async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
        try {
            const userId = socket.handshake.auth.id as string;

            const user = await User.exists({ _id: new mongoose.Types.ObjectId(userId) });
            if (!user) {
                next(new Error('Unknown user'));
                return;
            }

            const data: ClientSocketData = { userId };
            socket.data = data;
            next();
        } catch (e) {
            console.error(e);
            next(new Error('Socket authentication failed'));
        }
    },

    clientConnected: (socket: Socket): void => {
        const { userId } = socket.data as ClientSocketData;

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
            console.log(SocketEvent.SEND_MESSAGE, { userId, roomId, message });
            socket.to(roomId).emit(SocketEvent.RECEIVE_MESSAGE, { roomId, userId, message });
            sendPushToRoom(roomId, userId, {
                title: 'New message',
                body: message,
                type: 'message',
            });
        }));

        socket.on(SocketEvent.SEND_POINT, inRoom(SocketEvent.SEND_POINT, ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
            console.log(SocketEvent.SEND_POINT, { userId, roomId, x, y });
            socket.to(roomId).emit(SocketEvent.RECEIVE_POINT, { roomId, userId, x, y });
        }));

        // Join the room's channel on entry rather than at connect, so rooms joined or created
        // while connected work at once, and owners (`ownedRooms`) hear their own rooms.
        socket.on(SocketEvent.SEND_ENTER, inOrder(SocketEvent.SEND_ENTER, async ({ roomId }: { roomId: string }) => {
            if (!(await canEnter(userId, roomId))) {
                console.warn(SocketEvent.SEND_ENTER, 'refused: not a member', { userId, roomId });
                return;
            }
            console.log(SocketEvent.SEND_ENTER, { userId, roomId });
            presentRoomIds.add(roomId);
            await socket.join(roomId);
            socket.to(roomId).emit(SocketEvent.RECEIVE_ENTER, { roomId, userId });
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone entered the room',
                type: 'enter',
            });
        }));

        socket.on(SocketEvent.SEND_EXIT, inRoom(SocketEvent.SEND_EXIT, async ({ roomId }: { roomId: string }) => {
            console.log(SocketEvent.SEND_EXIT, { userId, roomId });
            presentRoomIds.delete(roomId);
            socket.to(roomId).emit(SocketEvent.RECEIVE_EXIT, { roomId, userId });
            await socket.leave(roomId);
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone left the room',
                type: 'exit',
            });
        }));

        socket.on(SocketEvent.SEND_TYPING, inRoom(SocketEvent.SEND_TYPING, ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
            console.log(SocketEvent.SEND_TYPING, { userId, roomId, isTyping });
            socket.to(roomId).emit(SocketEvent.RECEIVE_TYPING, { roomId, userId, isTyping });
        }));

        // A room action other than walking (sitting, emotes). Walks still travel as SEND_POINT.
        socket.on(SocketEvent.SEND_ACTION, inRoom(SocketEvent.SEND_ACTION, async ({ roomId, action }: { roomId: string; action: ActorAction }) => {
            if (!(await mayRelay(userId, action))) return;
            console.log(SocketEvent.SEND_ACTION, { userId, roomId, action });
            socket.to(roomId).emit(SocketEvent.RECEIVE_ACTION, { roomId, userId, action });
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
        socket.on(SocketEvent.DISCONNECT, reason => {
            for (const roomId of presentRoomIds) {
                console.log(SocketEvent.DISCONNECT, { userId, roomId, reason });
                socket.nsp.to(roomId).emit(SocketEvent.RECEIVE_EXIT, { roomId, userId });
            }
            presentRoomIds.clear();
        });
    },
};

export default handler;
