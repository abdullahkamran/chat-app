import { Socket } from 'socket.io';
import mongoose from 'mongoose';
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

            socket.on('send_message', ({ message, roomId }: { message: string; roomId: string }) => {
                console.log('send_message', { userId, roomId, message });
                socket.to(roomId).emit('receive_message', { roomId, userId, message });
                sendPushToRoom(roomId, userId, {
                    title: 'New message',
                    body: message,
                    type: 'message',
                });
            });

            socket.on('send_point', ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
                console.log('send_point', { userId, roomId, x, y });
                socket.to(roomId).emit('receive_point', { roomId, userId, x, y });
            });

            socket.on('send_enter', ({ roomId }: { roomId: string }) => {
                console.log('send_enter', { userId, roomId });
                socket.to(roomId).emit('receive_enter', { roomId, userId });
                sendPushToRoom(roomId, userId, {
                    title: 'Room activity',
                    body: 'Someone entered the room',
                    type: 'enter',
                });
            });

            socket.on('send_exit', ({ roomId }: { roomId: string }) => {
                console.log('send_exit', { userId, roomId });
                socket.to(roomId).emit('receive_exit', { roomId, userId });
                sendPushToRoom(roomId, userId, {
                    title: 'Room activity',
                    body: 'Someone left the room',
                    type: 'exit',
                });
            });
        } catch (e) {
            console.error(e);
            socket.disconnect();
        }
    },
};

export default handler;
