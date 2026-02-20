import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Room from '../models/room.model';

const controller = {
    getAll: async (_req: Request, res: Response): Promise<void> => {
        try {
            const rooms = await Room.getAll();
            res.send(rooms);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getByID: async (_req: Request, res: Response, id: string): Promise<void> => {
        try {
            const room = await Room.findById(new mongoose.Types.ObjectId(id))
                .populate('owners')
                .populate('members');
            res.send(room);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    addRoom: async (req: Request, res: Response): Promise<void> => {
        const room = new Room(req.body);
        try {
            if (!room.owners || !room.owners.length) {
                res.sendStatus(400);
            } else {
                const addedRoom = await Room.addRoom(room);
                res.send(addedRoom);
            }
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    deleteRoom: async (req: Request, res: Response): Promise<void> => {
        const room = req.body;
        try {
            await Room.deleteByID(room);
            res.sendStatus(200);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
