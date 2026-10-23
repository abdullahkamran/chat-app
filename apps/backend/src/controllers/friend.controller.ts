import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { Server } from 'socket.io';
import { FriendshipStatus, RoomCategory, type FriendRelation, type IncomingFriendRequest, type PublicUser } from '@chat-app/shared-types';
import Friendship, { IFriendship, pairKeyOf } from '../models/friendship.model';
import Room from '../models/room.model';
import User, { PUBLIC_USER_FIELDS } from '../models/user.model';
import { friendIdsOf, suggestionsFor } from '../services/friend.service';
import { sendPushToUsers } from '../services/notification.service';
import { toE164 } from '../services/phone.service';
import { announceFriendsChanged, announceMemberRemoved } from '../sockets/socketHandler';

/** Most numbers one contact sync may check. */
const MAX_CONTACT_NUMBERS = 3000;
/** Contact syncs one account may make per day (UTC). */
const MAX_CONTACT_SYNCS_PER_DAY = 10;

/** A Mongo duplicate-key error: here, a friendship for the pair was created meanwhile. */
function isDuplicateKey(e: unknown): boolean {
    return (e as { code?: number })?.code === 11000;
}

/** Tell both users' devices to refetch, and push `push` to `pushTo` when given. */
function notify(req: Request, userIds: string[], push?: { to: string; body: string; type: string }): void {
    announceFriendsChanged(req.app.get('io') as Server, userIds);
    if (push) {
        sendPushToUsers([push.to], { title: 'Friends', body: push.body, type: push.type }, { senderUserId: req.user!.userId });
    }
}

/** Accept the pending request `otherId` sent the user. False when there is none. */
async function acceptRequest(req: Request, userId: string, otherId: string): Promise<boolean> {
    const accepted = await Friendship.findOneAndUpdate(
        { pairKey: pairKeyOf(userId, otherId), requester: otherId, recipient: userId, status: FriendshipStatus.PENDING },
        { status: FriendshipStatus.ACCEPTED, acceptedAt: new Date() },
    );
    if (!accepted) return false;
    notify(req, [userId, otherId], {
        to: otherId,
        body: `${req.user!.username} accepted your friend request`,
        type: 'friend_accepted',
    });
    return true;
}

/** The `:userId` route param when it names another existing user; otherwise sends the error and returns null. */
async function otherUserParam(req: Request, res: Response, id: unknown): Promise<string | null> {
    if (typeof id !== 'string' || !mongoose.isValidObjectId(id) || !(await User.exists({ _id: id }))) {
        res.status(404).send({ error: 'User not found' });
        return null;
    }
    if (id === req.user!.userId) {
        res.status(400).send({ error: "You can't add yourself" });
        return null;
    }
    return id;
}

const controller = {
    // GET /friends — the user's friends, by username.
    getFriends: async (req: Request, res: Response): Promise<void> => {
        try {
            const ids = await friendIdsOf(req.user!.userId);
            const friends = await User.find({ _id: { $in: ids } }).select(PUBLIC_USER_FIELDS).sort({ username: 1 });
            res.send(friends);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // GET /friends/requests — pending requests sent to the user, newest first.
    getIncomingRequests: async (req: Request, res: Response): Promise<void> => {
        try {
            const pending = await Friendship.find({ recipient: req.user!.userId, status: FriendshipStatus.PENDING })
                .sort({ createdAt: -1 })
                .populate<{ requester: PublicUser | null }>('requester', PUBLIC_USER_FIELDS);
            const body: IncomingFriendRequest[] = pending
                // A requester whose account was deleted populates as null.
                .filter((f) => f.requester)
                .map((f) => ({ user: f.requester as PublicUser, sentAt: f.createdAt }));
            res.send(body);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /friends/requests { userId } — send a request. If they already sent one, this accepts it.
    sendRequest: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        try {
            const otherId = await otherUserParam(req, res, req.body?.userId);
            if (!otherId) return;
            const pairKey = pairKeyOf(userId, otherId);

            let existing: IFriendship | null = await Friendship.findOne({ pairKey });
            if (!existing) {
                try {
                    await Friendship.create({ requester: userId, recipient: otherId, status: FriendshipStatus.PENDING, pairKey });
                    res.send({ relation: 'requested' satisfies FriendRelation });
                    notify(req, [userId, otherId], {
                        to: otherId,
                        body: `${req.user!.username} sent you a friend request`,
                        type: 'friend_request',
                    });
                    return;
                } catch (e) {
                    // They requested us at the same moment: theirs won, so accept it below.
                    if (!isDuplicateKey(e)) throw e;
                    existing = await Friendship.findOne({ pairKey });
                    if (!existing) throw e;
                }
            }

            if (existing.status === FriendshipStatus.ACCEPTED) {
                res.send({ relation: 'friends' satisfies FriendRelation });
            } else if (existing.requester.toString() === userId) {
                res.send({ relation: 'requested' satisfies FriendRelation });
            } else {
                const accepted = await acceptRequest(req, userId, otherId);
                res.send({ relation: (accepted ? 'friends' : 'none') satisfies FriendRelation });
            }
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /friends/requests/:userId/accept — accept the request that user sent.
    acceptRequest: async (req: Request, res: Response): Promise<void> => {
        try {
            const otherId = await otherUserParam(req, res, req.params.userId);
            if (!otherId) return;
            if (!(await acceptRequest(req, req.user!.userId, otherId))) {
                res.status(404).send({ error: 'No pending request from this user' });
                return;
            }
            res.sendStatus(204);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // DELETE /friends/requests/:userId — decline their request, or cancel yours. No one is notified.
    deleteRequest: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        try {
            const otherId = await otherUserParam(req, res, req.params.userId);
            if (!otherId) return;
            const { deletedCount } = await Friendship.deleteOne({ pairKey: pairKeyOf(userId, otherId), status: FriendshipStatus.PENDING });
            if (!deletedCount) {
                res.status(404).send({ error: 'No pending request with this user' });
                return;
            }
            res.sendStatus(204);
            notify(req, [userId, otherId]);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // GET /friends/suggestions — Quick Add.
    getSuggestions: async (req: Request, res: Response): Promise<void> => {
        try {
            res.send(await suggestionsFor(req.user!.userId));
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /friends/suggestions/:userId/dismiss — hide someone from Quick Add for good.
    dismissSuggestion: async (req: Request, res: Response): Promise<void> => {
        const { userId: otherId } = req.params;
        if (!mongoose.isValidObjectId(otherId)) {
            res.status(404).send({ error: 'User not found' });
            return;
        }
        try {
            await User.updateOne({ _id: req.user!.userId }, { $addToSet: { dismissedSuggestions: otherId } });
            res.sendStatus(204);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /friends/contacts/sync { phoneNumbers } — find which of the user's contacts are on the app.
    // Only the matched users are kept (for Quick Add), never the numbers.
    syncContacts: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        const raw: unknown = req.body?.phoneNumbers;
        if (!Array.isArray(raw) || raw.length > MAX_CONTACT_NUMBERS) {
            res.status(400).send({ error: `phoneNumbers must be an array of at most ${MAX_CONTACT_NUMBERS} numbers` });
            return;
        }
        try {
            const today = new Date().toISOString().slice(0, 10);
            // Count this sync unless today's are used up, in one update so parallel syncs can't overrun it.
            // The cap stops one account from looking up which of many numbers are on the app.
            const counted = await User.updateOne(
                { _id: userId, $or: [{ 'contactSyncs.day': { $ne: today } }, { 'contactSyncs.count': { $lt: MAX_CONTACT_SYNCS_PER_DAY } }] },
                [{
                    $set: {
                        contactSyncs: {
                            day: today,
                            count: { $cond: [{ $eq: ['$contactSyncs.day', today] }, { $add: ['$contactSyncs.count', 1] }, 1] },
                        },
                    },
                }],
            );
            if (!counted.matchedCount) {
                res.status(429).send({ error: 'Contacts were checked too many times today' });
                return;
            }
            const numbers = [...new Set(raw.map(toE164).filter((n): n is string => !!n))];
            // Stored whether or not they allow being found by number; Quick Add checks that when it reads.
            const matches = await User.find({ phoneNumber: { $in: numbers }, _id: { $ne: userId } }).select('_id');
            await User.updateOne({ _id: userId }, { contactMatches: matches.map((m) => m._id) });
            res.send({ matched: matches.length });
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // DELETE /friends/:userId — unfriend. No one is notified, and shared group rooms are untouched.
    // Each loses access to the other's personal room, and is taken out of it if they're in it now.
    unfriend: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        try {
            const otherId = await otherUserParam(req, res, req.params.userId);
            if (!otherId) return;
            const { deletedCount } = await Friendship.deleteOne({ pairKey: pairKeyOf(userId, otherId), status: FriendshipStatus.ACCEPTED });
            if (!deletedCount) {
                res.status(404).send({ error: 'Not friends with this user' });
                return;
            }
            res.sendStatus(204);
            notify(req, [userId, otherId]);
            const io = req.app.get('io') as Server;
            const personalRooms = await Room.find({ ownerId: { $in: [userId, otherId] }, category: RoomCategory.PERSONAL }).select('ownerId');
            for (const room of personalRooms) {
                const visitor = room.ownerId.toString() === userId ? otherId : userId;
                announceMemberRemoved(io, room._id.toString(), visitor, 'unfriended');
            }
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
