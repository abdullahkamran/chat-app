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
import { toE164 } from '../services/phone.service';

/** `raw` (YYYY-MM-DD) as a Date at UTC midnight, or null unless it's a real date between 1900 and today. */
function parseDateOfBirth(raw: unknown): Date | null {
    if (typeof raw !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC rolls 2001-02-30 over to March, so a changed day means it wasn't a real date.
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (year < 1900 || date.getTime() > Date.now()) return null;
    return date;
}

const authController = {
    signup: async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password, email, city, state, country } = req.body;
            if (!username || !password || !email || !req.body.dateOfBirth) {
                res.status(400).send({ error: 'username, password, email, and dateOfBirth are required' });
                return;
            }
            const dateOfBirth = parseDateOfBirth(req.body.dateOfBirth);
            if (!dateOfBirth) {
                res.status(400).send({ error: 'dateOfBirth must be a real past date as YYYY-MM-DD' });
                return;
            }
            // Optional. Stored as E.164 so contact matching finds it however a friend saved it.
            let phoneNumber: string | undefined;
            if (req.body.phoneNumber) {
                phoneNumber = toE164(req.body.phoneNumber) ?? undefined;
                if (!phoneNumber) {
                    res.status(400).send({ error: 'phoneNumber must be a valid number with its country code, e.g. +923001234567' });
                    return;
                }
            }

            const duplicate = await User.findOne({
                $or: [{ username }, { email }, ...(phoneNumber ? [{ phoneNumber }] : [])],
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
            // Only these fields: the rest (coins, level, rooms...) start at their defaults.
            const user = new User({
                username, password: hashed, email, phoneNumber, dateOfBirth,
                city: city || undefined, state: state || undefined, country: country || undefined,
            });
            const saved = await user.save();
            try {
                await applySignupDefaults(saved._id as any, saved.username);
            } catch (e) {
                // Every user must have a personal room. Without one the signup fails, so it can be retried.
                await User.deleteOne({ _id: saved._id });
                throw e;
            }
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
