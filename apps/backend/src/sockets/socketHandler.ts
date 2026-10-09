import { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { SocketEvent } from '@chat-app/socket-constants';
import User from '../models/user.model';
import { sendPushToRoom } from '../services/notification.service';

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
