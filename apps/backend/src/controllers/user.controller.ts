import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';

const controller = {
    getAll: async (_req: Request, res: Response): Promise<void> => {
        try {
            const users = await User.getAll();
            res.send(users);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getByID: async (_req: Request, res: Response, id: string): Promise<void> => {
        try {
            const user = await User.findById(new mongoose.Types.ObjectId(id));
            res.send(user);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getByUsername: async (req: Request, res: Response): Promise<void> => {
        try {
            const user = await User.find({ username: req.query.username });
            res.send(user);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    addUser: async (req: Request, res: Response): Promise<void> => {
        const userToAdd = new User(req.body);
        try {
            const addedUser = await User.addUser(userToAdd);
            res.send(addedUser);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    deleteUser: async (req: Request, res: Response): Promise<void> => {
        const user = req.body;
        try {
            await User.deleteByID(user);
            res.sendStatus(200);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getRooms: async (_req: Request, res: Response, id: string): Promise<void> => {
        try {
            const user = await User.findById(new mongoose.Types.ObjectId(id)).populate('rooms');
            res.send(user?.rooms);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    savePushToken: async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { token } = req.body;
            if (!token) {
                res.status(400).send({ error: 'token is required' });
                return;
            }
            await User.findByIdAndUpdate(id, { $addToSet: { pushTokens: token } });
            res.sendStatus(200);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    removePushToken: async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { token } = req.body;
            if (!token) {
                res.status(400).send({ error: 'token is required' });
                return;
            }
            await User.findByIdAndUpdate(id, { $pull: { pushTokens: token } });
            res.sendStatus(200);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
