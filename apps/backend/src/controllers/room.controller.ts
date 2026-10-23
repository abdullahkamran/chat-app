import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { Server } from 'socket.io';
import Item from '../models/item.model';
import Room, { canManageMembers, IRoom } from '../models/room.model';
import { announceMemberRemoved, announceMembersAdded, announceRoomItemsChanged } from '../sockets/socketHandler';
import User, { PUBLIC_USER_FIELDS } from '../models/user.model';
import { friendIdsOf, notFriendsAmong } from '../services/friend.service';
import { sendPushToUsers } from '../services/notification.service';
import { findAccessibleRoom, isPersonalRoom } from '../services/room-access.service';
import { resolveRoomDefaults } from '../services/room-defaults.service';
import { RoomCategory, type PublicUser, type RoomMembers, type RoomRemovalReason } from '@chat-app/shared-types';

/**
 * The people `actorId` asked to add, deduplicated, leaving out `exclude` (the owner, people
 * already in the room). Only the actor's friends may be added; members needn't be friends
 * with each other. Returns the IDs, or an error message for a 400.
 */
async function idsToAdd(actorId: string, ids: unknown, exclude: string[]): Promise<{ ids: string[] } | { error: string }> {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
        return { error: 'Expected an array of user IDs' };
    }
    const wanted = [...new Set(ids as string[])].filter((id) => !exclude.includes(id));
    if ((await notFriendsAmong(actorId, wanted)).length) return { error: 'You can only add your friends' };
    return { ids: wanted };
}

/**
 * Answers 404 or 403 for a `findAccessibleRoom` result that isn't a room, and narrows it when it is.
 */
export function sendIfNoAccess(res: Response, room: IRoom | null | false): room is null | false {
    if (room === null) res.status(404).send({ error: 'Room not found' });
    else if (room === false) res.status(403).send({ error: 'Forbidden' });
    return !room;
}

const NO_MEMBERS_IN_PERSONAL_ROOMS = "Personal rooms don't have members";

/** Tell people they were added: their devices refetch their room list, and get a push. */
function notifyAdded(req: Request, room: Pick<IRoom, '_id' | 'name'>, userIds: string[]): void {
    const roomId = room._id.toString();
    announceMembersAdded(req.app.get('io') as Server, roomId, userIds);
    sendPushToUsers(
        userIds,
        { title: room.name, body: `${req.user!.username} added you to the room`, type: 'added' },
        { roomId, senderUserId: req.user!.userId },
    );
}

/** Take a member out of a room, on the room and on their user document. */
async function dropMember(req: Request, roomId: string, userId: string, reason: RoomRemovalReason): Promise<void> {
    await Room.updateOne({ _id: roomId }, { $pull: { members: userId } });
    await User.updateOne({ _id: userId }, { $pull: { rooms: roomId } });
    announceMemberRemoved(req.app.get('io') as Server, roomId, userId, reason);
}

const controller = {
    // GET /rooms/:id — the room's summary, for anyone who may enter it.
    getByID: async (req: Request, res: Response, id: string): Promise<void> => {
        try {
            const room = await findAccessibleRoom(id, req.user!.userId, 'name description personLimit dimensions createdAt updatedAt');
            if (sendIfNoAccess(res, room)) return;
            await room.populate([
                { path: 'ownerId', select: PUBLIC_USER_FIELDS },
                { path: 'members', select: PUBLIC_USER_FIELDS },
            ]);
            res.send(room);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms { name, description?, members?, personLimit? } — a group room. Personal rooms are only made at signup.
    createRoom: async (req: Request, res: Response): Promise<void> => {
        const { name, description, members, personLimit } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).send({ error: 'name is required' });
            return;
        }
        const creatorId = req.user!.userId;
        try {
            const picked = await idsToAdd(creatorId, members ?? [], [creatorId]);
            if ('error' in picked) {
                res.status(400).send({ error: picked.error });
                return;
            }
            const memberIds = picked.ids;
            const roomDefaults = await resolveRoomDefaults({ personLimit });
            // The owner takes a place too.
            if (memberIds.length + 1 > roomDefaults.personLimit) {
                res.status(400).send({ error: `A room holds at most ${roomDefaults.personLimit} people, you included` });
                return;
            }
            const room = new Room({
                ...roomDefaults,
                name: name.trim(),
                description: typeof description === 'string' ? description.trim() : '',
                category: RoomCategory.GROUP,
                members: memberIds,
                ownerId: creatorId,
            });
            const addedRoom = await Room.createRoom(room);
            await User.findByIdAndUpdate(
                new mongoose.Types.ObjectId(creatorId),
                { $addToSet: { ownedRooms: addedRoom._id } },
            );
            if (memberIds.length) {
                await User.updateMany(
                    { _id: { $in: memberIds } },
                    { $addToSet: { rooms: addedRoom._id } },
                );
            }
            res.status(201).send(addedRoom);
            notifyAdded(req, addedRoom, memberIds);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    getDetails: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;

        try {
            const room = await findAccessibleRoom(roomId, userId);
            if (sendIfNoAccess(res, room)) return;
            await room.populate([
                { path: 'members', select: PUBLIC_USER_FIELDS },
                { path: 'items.itemId' },
                { path: 'theme.floor' },
                { path: 'theme.leftWall' },
                { path: 'theme.rightWall' },
            ]);
            res.send(room);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    updateItems: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        const { items } = req.body;

        if (!Array.isArray(items)) {
            res.status(400).send({ error: 'items must be an array' });
            return;
        }

        let room;
        try {
            room = await Room.findById(new mongoose.Types.ObjectId(roomId));
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (room.ownerId.toString() !== userId) {
                res.status(403).send({ error: 'Only the room owner can edit items' });
                return;
            }

            room.items = items.map((i: { itemId: string; position: { x: number; y: number; z: number }; orientation: string; state: string }) => ({
                itemId: new mongoose.Types.ObjectId(i.itemId),
                position: i.position,
                orientation: i.orientation,
                state: i.state,
            }));
            await room.save();
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
            return;
        }
        res.sendStatus(204);

        try {
            // Footprints, so the room can stand people off furniture (see announceRoomItemsChanged).
            const defs = await Item.find({ _id: { $in: room.items.map(i => i.itemId) } }).select('dimensions isOverlappable');
            const byId = new Map(defs.map(d => [d._id.toString(), d]));
            const door = room.doors.find(d => d.isEntry)?.position ?? { x: 0, y: 0 };
            announceRoomItemsChanged(req.app.get('io') as Server, roomId, {
                dimensions: room.dimensions,
                door: { x: door.x, y: door.y },
                items: room.items.flatMap(i => {
                    const def = byId.get(i.itemId.toString());
                    return def
                        ? [{ position: i.position, orientation: i.orientation, dimensions: def.dimensions, isOverlappable: def.isOverlappable }]
                        : [];
                }),
            });
        } catch (e) {
            console.error('Failed to announce the new layout', e);
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
            const friendIds = (await friendIdsOf(userId)).map((id) => new mongoose.Types.ObjectId(id));

            // The user's own rooms (their personal room among them) and rooms they're in, plus every
            // friend's personal room: those are open to them like a DM.
            const filter = {
                $or: [
                    { _id: { $in: allRoomIds } },
                    { category: RoomCategory.PERSONAL, ownerId: { $in: friendIds } },
                ],
            };
            const [rooms, total] = await Promise.all([
                Room.find(filter).select('-items -doors -theme').sort({ updatedAt: -1, _id: 1 }).skip(skip).limit(limit),
                Room.countDocuments(filter),
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

    // GET /rooms/:roomId/members — owner and members, for anyone who may enter the room.
    getMembers: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        try {
            const room = await findAccessibleRoom(roomId, userId, 'personLimit');
            if (sendIfNoAccess(res, room)) return;
            const canManage = canManageMembers(room, userId);
            await room.populate<{ ownerId: PublicUser; members: PublicUser[] }>([
                { path: 'ownerId', select: PUBLIC_USER_FIELDS },
                { path: 'members', select: PUBLIC_USER_FIELDS, options: { sort: { username: 1 } } },
            ]);
            const body: RoomMembers = {
                owner: room.ownerId as unknown as PublicUser,
                // A member whose account was deleted populates as null.
                members: (room.members as unknown as (PublicUser | null)[]).filter((m): m is PublicUser => !!m),
                personLimit: room.personLimit,
                canManageMembers: canManage,
            };
            res.send(body);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/members { userIds } — add people to an existing room.
    addMembers: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('ownerId members personLimit name category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: NO_MEMBERS_IN_PERSONAL_ROOMS });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only the room owner can add people' });
                return;
            }
            const already = [room.ownerId.toString(), ...room.members.map((id) => id.toString())];
            const picked = await idsToAdd(userId, req.body?.userIds, already);
            if ('error' in picked) {
                res.status(400).send({ error: picked.error });
                return;
            }
            const newIds = picked.ids;
            if (newIds.length === 0) {
                res.status(400).send({ error: 'Everyone picked is already in the room' });
                return;
            }
            // The limit check is part of the update, so two adds at once can't both pass it.
            // Owner + current members + new members must fit.
            const updated = await Room.findOneAndUpdate(
                {
                    _id: room._id,
                    $expr: { $lte: [{ $add: [{ $size: '$members' }, newIds.length, 1] }, '$personLimit'] },
                },
                { $addToSet: { members: { $each: newIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
            );
            if (!updated) {
                res.status(400).send({ error: `A room holds at most ${room.personLimit} people, you included` });
                return;
            }
            await User.updateMany({ _id: { $in: newIds } }, { $addToSet: { rooms: room._id } });
            res.sendStatus(204);
            notifyAdded(req, room, newIds);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // DELETE /rooms/:roomId/members/:userId — remove someone from the room.
    removeMember: async (req: Request, res: Response): Promise<void> => {
        const { roomId, userId: targetId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(targetId)) {
            res.status(404).send({ error: 'Not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('ownerId members category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: NO_MEMBERS_IN_PERSONAL_ROOMS });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only the room owner can remove people' });
                return;
            }
            if (room.ownerId.toString() === targetId) {
                res.status(400).send({ error: "The room owner can't be removed" });
                return;
            }
            if (!room.members.some((id) => id.toString() === targetId)) {
                res.status(404).send({ error: 'Not a member of this room' });
                return;
            }
            await dropMember(req, roomId, targetId, 'removed');
            res.sendStatus(204);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/leave — a member leaves. The owner can't (what happens to their room is still open).
    leave: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('ownerId members');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (room.ownerId.toString() === userId) {
                res.status(400).send({ error: "The room owner can't leave their room" });
                return;
            }
            if (!room.members.some((id) => id.toString() === userId)) {
                res.status(404).send({ error: 'Not a member of this room' });
                return;
            }
            await dropMember(req, roomId, userId, 'left');
            res.sendStatus(204);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
