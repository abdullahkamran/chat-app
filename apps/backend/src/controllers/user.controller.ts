import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { PUBLIC_USER_FIELDS } from '../models/user.model';
import AvatarModel from '../models/avatar.model';
import { populateAvatar } from './avatar.controller';

/** Most users one search returns. */
const SEARCH_LIMIT = 20;

/** `text` with regex metacharacters escaped, to match it literally. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const controller = {
    // GET /users/me — the signed-in user's own profile, private fields included.
    getMe: async (req: Request, res: Response): Promise<void> => {
        try {
            const user = await User.findById(req.user!.userId);
            if (!user) { res.sendStatus(404); return; }
            res.send(user);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // GET /users/:id — another user's public profile.
    getByID: async (_req: Request, res: Response, id: string): Promise<void> => {
        if (!mongoose.isValidObjectId(id)) { res.sendStatus(404); return; }
        try {
            const user = await User.findById(id).select(PUBLIC_USER_FIELDS);
            if (!user) { res.sendStatus(404); return; }
            res.send(user);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // GET /users/search?q= — users whose username starts with q, ignoring case. Leaves out the caller.
    search: async (req: Request, res: Response): Promise<void> => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!q) { res.send([]); return; }
        try {
            const users = await User.find({
                _id: { $ne: req.user!.userId },
                username: { $regex: `^${escapeRegex(q)}`, $options: 'i' },
            })
                .select(PUBLIC_USER_FIELDS)
                .sort({ username: 1 })
                .limit(SEARCH_LIMIT);
            res.send(users);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    savePushToken: async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.user!.userId;
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
            const id = req.user!.userId;
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

    // GET /users/:id/avatar — get a user's selected avatar (for room display)
    getSelectedAvatar: async (_req: Request, res: Response, id: string): Promise<void> => {
        try {
            const user = await User.findById(new mongoose.Types.ObjectId(id)).select('selectedAvatar avatars');
            if (!user) { res.sendStatus(404); return; }

            const avatarId = user.selectedAvatar ?? user.avatars[0];
            if (!avatarId) { res.sendStatus(404); return; }

            const avatar = await AvatarModel.findById(avatarId);
            if (!avatar) { res.sendStatus(404); return; }

            const populated = await populateAvatar(avatar);
            res.send(populated);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
