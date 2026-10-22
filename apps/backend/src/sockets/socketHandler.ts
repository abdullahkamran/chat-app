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

interface ClientSocketData {
    userId: string;
    /** Rooms the user belongs to; the socket joins these to receive their events. */
    memberRoomIds: string[];
}

const handler = {
    /**
     * Connection middleware. Runs before 'connection', so the user lookup can't
     * race the client's first events (handlers attached after an await miss them).
     */
    authenticate: async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
        try {
            const userId = socket.handshake.auth.id as string;

            const user = await User.findById(new mongoose.Types.ObjectId(userId)).populate('rooms');
            if (!user) {
                next(new Error('Unknown user'));
                return;
            }

            const data: ClientSocketData = {
                userId,
                memberRoomIds: user.rooms.map(room => room._id.toString()),
            };
            socket.data = data;
            next();
        } catch (e) {
            console.error(e);
            next(new Error('Socket authentication failed'));
        }
    },

    clientConnected: (socket: Socket): void => {
        const { userId, memberRoomIds } = socket.data as ClientSocketData;

        // Rooms this socket is currently standing in (entered and not yet exited).
        // Used to announce an exit when the connection drops without SEND_EXIT.
        const presentRoomIds = new Set<string>();

        for (const roomId of memberRoomIds) {
            socket.join(roomId);
        }

        socket.on(SocketEvent.SEND_MESSAGE, ({ message, roomId }: { message: string; roomId: string }) => {
            console.log(SocketEvent.SEND_MESSAGE, { userId, roomId, message });
            socket.to(roomId).emit(SocketEvent.RECEIVE_MESSAGE, { roomId, userId, message });
            sendPushToRoom(roomId, userId, {
                title: 'New message',
                body: message,
                type: 'message',
            });
        });

        socket.on(SocketEvent.SEND_POINT, ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
            console.log(SocketEvent.SEND_POINT, { userId, roomId, x, y });
            socket.to(roomId).emit(SocketEvent.RECEIVE_POINT, { roomId, userId, x, y });
        });

        socket.on(SocketEvent.SEND_ENTER, ({ roomId }: { roomId: string }) => {
            console.log(SocketEvent.SEND_ENTER, { userId, roomId });
            presentRoomIds.add(roomId);
            socket.to(roomId).emit(SocketEvent.RECEIVE_ENTER, { roomId, userId });
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone entered the room',
                type: 'enter',
            });
        });

        socket.on(SocketEvent.SEND_EXIT, ({ roomId }: { roomId: string }) => {
            console.log(SocketEvent.SEND_EXIT, { userId, roomId });
            presentRoomIds.delete(roomId);
            socket.to(roomId).emit(SocketEvent.RECEIVE_EXIT, { roomId, userId });
            sendPushToRoom(roomId, userId, {
                title: 'Room activity',
                body: 'Someone left the room',
                type: 'exit',
            });
        });

        socket.on(SocketEvent.SEND_TYPING, ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
            console.log(SocketEvent.SEND_TYPING, { userId, roomId, isTyping });
            socket.to(roomId).emit(SocketEvent.RECEIVE_TYPING, { roomId, userId, isTyping });
        });

        // A room action other than walking (sitting, later emotes). Walks still travel as SEND_POINT.
        socket.on(SocketEvent.SEND_ACTION, async ({ roomId, action }: { roomId: string; action: ActorAction }) => {
            try {
                if (!(await mayRelay(userId, action))) return;
                console.log(SocketEvent.SEND_ACTION, { userId, roomId, action });
                socket.to(roomId).emit(SocketEvent.RECEIVE_ACTION, { roomId, userId, action });
            } catch (e) {
                console.error(SocketEvent.SEND_ACTION, e);
            }
        });

        // The user saved or switched avatars. Everyone sharing a room with them refetches it.
        socket.on(SocketEvent.SEND_AVATAR_CHANGED, () => {
            for (const roomId of presentRoomIds) {
                console.log(SocketEvent.SEND_AVATAR_CHANGED, { userId, roomId });
                socket.to(roomId).emit(SocketEvent.RECEIVE_AVATAR_CHANGED, { roomId, userId });
            }
        });

        // The app was killed, crashed or lost its connection without exiting.
        // Remove the character for everyone else. No push: flaky networks would spam it,
        // and a reconnecting client re-enters on its own.
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
