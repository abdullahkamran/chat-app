import User from "../models/user.model.js";
import mongoose from 'mongoose';
import { response } from "express";

const handler = {}

handler.clientConnected = async (socket) => {
    try {
        const userId = socket.handshake.auth.id;

        const user = await User.findById(mongoose.Types.ObjectId(`${userId}`)).populate("rooms");
        const userRooms = user.rooms;

        for (const room of userRooms) {
            socket.join(room._id.toString());
        }

        socket.on('send_message', ({ message, roomId }) => {
            console.log('send_message', { userId, roomId, message});
            socket.to(`${roomId}`).emit('receive_message', { roomId, userId, message });
        });

        socket.on('send_point', ({ roomId, x, y }) => {
            console.log('send_point', { userId, roomId, x, y });
            socket.to(`${roomId}`).emit('receive_point', { roomId, userId, x, y });
        });

        socket.on('send_enter', ({ roomId }) => {
            console.log('send_enter', { userId, roomId });
            socket.to(`${roomId}`).emit('receive_enter', { roomId, userId });
        });

        socket.on('send_exit', ({ roomId }) => {
            console.log('send_exit', { userId, roomId });
            socket.to(`${roomId}`).emit('receive_exit', { roomId, userId });
        });

        socket.on('receive_message', ({ roomId, userId, message }) => {
            console.log('received');
            console.log(roomId, userId, message)
        });
    
    } catch (e) {
        console.error(e);
        socket.disconnect();
    } 
}

export default handler;