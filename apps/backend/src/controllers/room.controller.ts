import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Room from '../models/room.model';
import User from '../models/user.model';

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
            const room = await Room.findById(new mongoose.Types.ObjectId(id)).populate('ownerId');
            res.send(room);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    createRoom: async (req: Request, res: Response): Promise<void> => {
        const { name, members, ...rest } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).send({ error: 'name is required' });
            return;
        }
        const creatorId = req.user!.userId;
        const room = new Room({ ...rest, name: name.trim(), members: members ?? [], ownerId: creatorId });
        try {
            const addedRoom = await Room.createRoom(room);
            await User.findByIdAndUpdate(
                new mongoose.Types.ObjectId(creatorId),
                { $addToSet: { ownedRooms: addedRoom._id } },
            );
            if (members?.length) {
                await User.updateMany(
                    { _id: { $in: members.map((id: string) => new mongoose.Types.ObjectId(id)) } },
                    { $addToSet: { rooms: addedRoom._id } },
                );
            }
            res.status(201).send(addedRoom);
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

    getDetails: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;

        try {
            const user = await User.findById(new mongoose.Types.ObjectId(userId)).select('rooms ownedRooms');
            if (!user) {
                res.status(404).send({ error: 'User not found' });
                return;
            }

            const memberRoomIds = [...user.rooms, ...user.ownedRooms].map((id) => id.toString());
            if (!memberRoomIds.includes(roomId)) {
                res.status(403).send({ error: 'Forbidden' });
                return;
            }

            const room = await Room.findById(new mongoose.Types.ObjectId(roomId))
                .populate('members', '-password -refreshTokens -pushTokens')
                .populate('items.itemId')
                .populate('theme.floor')
                .populate('theme.leftWall')
                .populate('theme.rightWall');

            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }

            res.send(room);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getRooms: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        try {
            const user = await User.findById(new mongoose.Types.ObjectId(userId)).select('rooms ownedRooms');
            if (!user) {
                res.status(404).send({ error: 'User not found' });
                return;
            }

            const allRoomIds = [...new Set([
                ...user.rooms.map((id) => id.toString()),
                ...user.ownedRooms.map((id) => id.toString()),
            ])].map((id) => new mongoose.Types.ObjectId(id));

            const [rooms, total] = await Promise.all([
                Room.find({ _id: { $in: allRoomIds } }).skip(skip).limit(limit).sort({ updatedAt: -1 }),
                Room.countDocuments({ _id: { $in: allRoomIds } }),
            ]);

            res.send({
                rooms,
                page,
                limit,
                total,
                hasMore: skip + rooms.length < total,
            });
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
