import { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { SocketEvent } from '@chat-app/socket-constants';
import User from '../models/user.model';
import { sendPushToRoom } from '../services/notification.service';

const handler = {
    clientConnected: async (socket: Socket): Promise<void> => {
        try {
            const userId = socket.handshake.auth.id as string;

            const user = await User.findById(new mongoose.Types.ObjectId(userId)).populate('rooms');
            if (!user) {
                socket.disconnect();
                return;
            }

            for (const room of user.rooms) {
                socket.join(room._id.toString());
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
                socket.to(roomId).emit(SocketEvent.RECEIVE_ENTER, { roomId, userId });
                sendPushToRoom(roomId, userId, {
                    title: 'Room activity',
                    body: 'Someone entered the room',
                    type: 'enter',
                });
            });

            socket.on(SocketEvent.SEND_EXIT, ({ roomId }: { roomId: string }) => {
                console.log(SocketEvent.SEND_EXIT, { userId, roomId });
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
        } catch (e) {
            console.error(e);
            socket.disconnect();
        }
    },
};

export default handler;
