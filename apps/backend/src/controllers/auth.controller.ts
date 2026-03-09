import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user.model';
import AvatarModel from '../models/avatar.model';
import { populateAvatar } from './avatar.controller';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from '../services/auth.service';
import { applySignupDefaults } from '../services/signup-defaults.service';

const authController = {
    signup: async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password, email, phoneNumber, city, state, country } = req.body;
            if (!username || !password || !email || !phoneNumber || !city || !state || !country) {
                res.status(400).send({ error: 'username, password, email, phoneNumber, city, state, and country are required' });
                return;
            }

            const duplicate = await User.findOne({
                $or: [{ username }, { email }, { phoneNumber }],
            }).select('username email phoneNumber');

            if (duplicate) {
                if (duplicate.username === username) {
                    res.status(409).send({ error: 'username already exists' });
                } else if (duplicate.email === email) {
                    res.status(409).send({ error: 'email already exists' });
                } else {
                    res.status(409).send({ error: 'phone number already exists' });
                }
                return;
            }

            const hashed = await bcrypt.hash(password, 10);
            const user = new User({ ...req.body, password: hashed });
            const saved = await user.save();
            await applySignupDefaults(saved._id as any, saved.username);
            res.status(201).send(saved);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    login: async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                res.status(400).send({ error: 'username and password are required' });
                return;
            }

            const user = await User.findOne({ username });
            if (!user) {
                res.status(401).send({ error: 'Invalid credentials' });
                return;
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                res.status(401).send({ error: 'Invalid credentials' });
                return;
            }

            const payload = { userId: user._id.toString(), username: user.username };
            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);

            await User.findByIdAndUpdate(user._id, {
                $addToSet: { refreshTokens: refreshToken },
                lastLogin: Date.now(),
            });

            let selectedAvatar = null;
            if (user.selectedAvatar) {
                const avatarDoc = await AvatarModel.findById(user.selectedAvatar);
                if (avatarDoc) selectedAvatar = await populateAvatar(avatarDoc);
            }

            res.send({ accessToken, refreshToken, userId: user._id, selectedAvatar });
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    refresh: async (req: Request, res: Response): Promise<void> => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                res.status(400).send({ error: 'refreshToken is required' });
                return;
            }

            let payload;
            try {
                payload = verifyRefreshToken(refreshToken);
            } catch {
                res.status(401).send({ error: 'Invalid or expired refresh token' });
                return;
            }

            const user = await User.findById(payload.userId);
            if (!user || !user.refreshTokens.includes(refreshToken)) {
                res.status(401).send({ error: 'Invalid refresh token' });
                return;
            }

            // Rotate: replace old token with a new pair
            const newAccessToken = generateAccessToken({ userId: payload.userId, username: payload.username });
            const newRefreshToken = generateRefreshToken({ userId: payload.userId, username: payload.username });

            await User.findByIdAndUpdate(user._id, { $pull: { refreshTokens: refreshToken } });
            await User.findByIdAndUpdate(user._id, { $addToSet: { refreshTokens: newRefreshToken } });

            let selectedAvatar = null;
            if (user.selectedAvatar) {
                const avatarDoc = await AvatarModel.findById(user.selectedAvatar);
                if (avatarDoc) selectedAvatar = await populateAvatar(avatarDoc);
            }

            res.send({ accessToken: newAccessToken, refreshToken: newRefreshToken, selectedAvatar });
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    logout: async (req: Request, res: Response): Promise<void> => {
        try {
            const { refreshToken } = req.body;
            if (refreshToken) {
                try {
                    const payload = verifyRefreshToken(refreshToken);
                    await User.findByIdAndUpdate(payload.userId, {
                        $pull: { refreshTokens: refreshToken },
                    });
                } catch {
                    // Token already expired — nothing to clean up
                }
            }
            res.sendStatus(200);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },
};

export default authController;
