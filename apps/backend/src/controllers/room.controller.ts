import { randomInt } from 'crypto';
import { Request, Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import type { Server } from 'socket.io';
import { inTransaction } from '../db/transaction';
import Room, { canManageMembers, IRoom, isProtectedCreator, isRoomOwner } from '../models/room.model';
import { MailboxRead, RoomMail } from '../models/room-mail.model';
import { roomLayoutOf } from '../sockets/roomLayout';
import { announceMemberRemoved, announceMembersAdded, announceOwnersChanged, announceRoomItemsChanged } from '../sockets/socketHandler';
import Item from '../models/item.model';
import User, { PUBLIC_USER_FIELDS } from '../models/user.model';
import { friendIdsOf, notFriendsAmong } from '../services/friend.service';
import { sendPushToUsers } from '../services/notification.service';
import { findAccessibleRoom, isPersonalRoom } from '../services/room-access.service';
import { resolveRoomDefaults } from '../services/room-defaults.service';
import { addReturn, changeCounts, freeCount, giveBack, type Returns } from '../services/inventory.service';
import { RoomCategory, themeSlotsOf, type PublicUser, type RoomItemsUpdate, type RoomLeaveResult, type RoomMembers, type RoomThemeSlot } from '@chat-app/shared-types';

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

const THEME_SLOTS: RoomThemeSlot[] = ['floor', 'leftWall', 'rightWall'];

/**
 * Sets the room's floor and wall theme from `{ floor, leftWall, rightWall }` item IDs.
 * A slot left unchanged is kept as is (the default theme items aren't owned); a new one
 * must be a wallpaper or flooring that fits the slot and is in the owner's inventory.
 * Returns an error message for a 400, or null once applied (not yet saved).
 */
async function applyTheme(room: IRoom, userId: string, theme: unknown, session: ClientSession): Promise<string | null> {
    if (typeof theme !== 'object' || theme === null) return 'theme must be an object';
    const wanted = theme as Partial<Record<RoomThemeSlot, unknown>>;
    const changes: Array<[RoomThemeSlot, string]> = [];
    for (const slot of THEME_SLOTS) {
        const id = wanted[slot];
        if (id === undefined || id === null || id === room.theme[slot]?.toString()) continue;
        if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) return `Invalid ${slot}`;
        changes.push([slot, id]);
    }
    if (!changes.length) return null;

    const ids = [...new Set(changes.map(([, id]) => id))];
    const [user, found] = await Promise.all([
        User.findById(new mongoose.Types.ObjectId(userId)).select('inventory').session(session),
        Item.find({ _id: { $in: ids } }).select('category').session(session),
    ]);
    for (const [slot, id] of changes) {
        const item = found.find(i => i._id.toString() === id);
        if (!item || !themeSlotsOf(item).includes(slot)) return `That item can't go on the ${slot}`;
        // A wallpaper or flooring stays in the inventory while it's on a room.
        if (!user || freeCount(user, id) <= 0) return "You don't own that item";
    }
    for (const [slot, id] of changes) room.theme[slot] = new mongoose.Types.ObjectId(id);
    return null;
}

/** A room edit refused with a status and message for the client. Thrown to abort its transaction. */
class EditRefused extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

type ItemInput = RoomItemsUpdate['items'][number];

const isObjectId = (v: unknown): v is string => typeof v === 'string' && mongoose.isValidObjectId(v);
const isPoint = (p: unknown): boolean =>
    typeof p === 'object' && p !== null && ['x', 'y', 'z'].every((k) => Number.isFinite((p as Record<string, unknown>)[k]));

/** Checks the shape of a `RoomItemsUpdate`. Returns an error message for a 400, or null. */
function badItemsUpdate(body: Partial<RoomItemsUpdate>): string | null {
    if (!Array.isArray(body.items)) return 'items must be an array';
    for (const i of body.items as unknown[]) {
        if (typeof i !== 'object' || i === null) return 'Each item must be an object';
        const item = i as Partial<ItemInput>;
        if (item._id !== undefined && !isObjectId(item._id)) return 'Invalid item _id';
        if (item._id === undefined && !isObjectId(item.itemId)) return 'Invalid itemId';
        if (!isPoint(item.position)) return 'Invalid item position';
    }
    if (body.knownItemIds !== undefined && !(Array.isArray(body.knownItemIds) && body.knownItemIds.every(isObjectId))) {
        return 'knownItemIds must be an array of item IDs';
    }
    return null;
}

type SavedItem = IRoom['items'][number] & { _id: mongoose.Types.ObjectId };

/** Who a placed copy goes back to. Items from before `placedBy` existed are the creator's. */
const placerOf = (room: Pick<IRoom, 'ownerId'>, item: Pick<SavedItem, 'placedBy'>) => item.placedBy ?? room.ownerId;

/** What taking every item out of a room gives back, and to whom. */
function returnsOf(room: Pick<IRoom, 'ownerId' | 'items'>): Returns {
    const returns: Returns = new Map();
    for (const item of room.items ?? []) addReturn(returns, placerOf(room, item), item.itemId);
    return returns;
}

/**
 * Deletes the group room matching `filter` and gives its items back to whoever placed them, in one
 * transaction. Returns the deleted room, or null when none matched.
 */
function deleteRoomGivingBack(filter: Record<string, unknown>) {
    return inTransaction(async (session) => {
        const deleted = await Room.findOneAndDelete(filter, { session }).select('owners members ownerId items');
        if (deleted) await giveBack(returnsOf(deleted), session);
        return deleted;
    });
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

/**
 * Clean up after a group room was deleted: its postbox goes, and everyone in it is taken out and
 * told. `actorId` (who deleted it, or the last to leave) is told they left.
 */
async function afterRoomDeleted(req: Request, room: Pick<IRoom, '_id' | 'members' | 'owners'>, actorId: string): Promise<void> {
    const people = [...new Set([...room.members, ...room.owners].map((id) => id.toString()))];
    await Promise.all([
        RoomMail.deleteMany({ roomId: room._id }),
        MailboxRead.deleteMany({ roomId: room._id }),
    ]);
    const io = req.app.get('io') as Server;
    for (const id of people) announceMemberRemoved(io, room._id.toString(), id, id === actorId ? 'left' : 'deleted');
}

/** Someone was made an owner: the room and their devices hear of it, and they get a push. */
function notifyNewOwner(req: Request, room: Pick<IRoom, '_id' | 'name'>, userId: string, body: string): void {
    const roomId = room._id.toString();
    announceOwnersChanged(req.app.get('io') as Server, roomId, [userId]);
    sendPushToUsers([userId], { title: room.name, body, type: 'owner' }, { roomId, senderUserId: req.user!.userId });
}

/** How many times leaving re-reads the room when someone else changed it at the same moment. */
const LEAVE_ATTEMPTS = 5;

const ROOM_CHANGED = 'The room changed just now. Try again.';

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
                // The creator is the first owner and, like every owner, a member too.
                members: [creatorId, ...memberIds],
                owners: [creatorId],
                ownerId: creatorId,
            });
            const addedRoom = await Room.createRoom(room);
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

    /**
     * PATCH /rooms/:roomId/items (RoomItemsUpdate) — an owner saves the room's layout and theme.
     * A new item comes out of the editor's inventory; a removed one goes back to whoever placed it,
     * which may be another owner. Merged with what other owners saved meanwhile (see RoomItemsUpdate).
     */
    updateItems: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        const body = req.body as Partial<RoomItemsUpdate>;

        const bad = badItemsUpdate(body);
        if (bad) {
            res.status(400).send({ error: bad });
            return;
        }
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        const wanted = body.items as ItemInput[];

        let room: IRoom;
        try {
            // One transaction, so inventories and the room change together. Another save to the
            // room, or a purchase by someone whose copy comes back, at the same moment makes
            // Mongoose run it again from the top.
            room = await inTransaction(async (session) => {
                const room = await Room.findById(roomId).session(session);
                if (!room) throw new EditRefused(404, 'Room not found');
                if (!isRoomOwner(room, userId)) throw new EditRefused(403, 'Only room owners can edit items');

                if (body.theme !== undefined && body.theme !== null) {
                    const error = await applyTheme(room, userId, body.theme, session);
                    if (error) throw new EditRefused(400, error);
                }

                const saved = new Map((room.items as SavedItem[]).map((i) => [i._id.toString(), i]));
                // An old client sends no knownItemIds: it means to replace everything.
                const known = new Set(body.knownItemIds ?? saved.keys());
                const me = new mongoose.Types.ObjectId(userId);
                const kept = new Set<string>();
                const taken = new Map<string, number>();
                const returns: Returns = new Map();
                const next: Array<Record<string, unknown>> = [];

                for (const i of wanted) {
                    const look = { position: i.position, orientation: i.orientation, state: i.state };
                    if (i._id) {
                        const was = saved.get(i._id);
                        // Gone: another owner took it out meanwhile, and it's back with its placer.
                        if (!was || kept.has(i._id)) continue;
                        kept.add(i._id);
                        // What it is and whose stays as saved; only where it stands and how changes.
                        next.push({ _id: was._id, itemId: was.itemId, placedBy: placerOf(room, was), ...look });
                    } else {
                        next.push({ itemId: new mongoose.Types.ObjectId(i.itemId), placedBy: me, ...look });
                        taken.set(i.itemId, (taken.get(i.itemId) ?? 0) + 1);
                    }
                }
                for (const [id, was] of saved) {
                    if (kept.has(id)) continue;
                    // Known and not sent back: the editor took it out. Unknown: another owner placed
                    // it after the editor started, so it stays.
                    if (known.has(id)) addReturn(returns, placerOf(room, was), was.itemId);
                    else next.push({ _id: was._id, itemId: was.itemId, placedBy: placerOf(room, was), position: was.position, orientation: was.orientation, state: was.state });
                }

                if (taken.size) {
                    const items = await Item.find({ _id: { $in: [...taken.keys()] } }).select('name category').session(session);
                    for (const id of taken.keys()) {
                        const item = items.find((it) => it._id.toString() === id);
                        if (!item) throw new EditRefused(400, 'Unknown item');
                        if (themeSlotsOf(item).length) throw new EditRefused(400, `${item.name} goes on the walls or floor`);
                    }
                }
                // What the editor places, less their own copies they took out.
                const mine = new Map([...taken].map(([id, n]) => [id, -n]));
                for (const [id, n] of returns.get(userId) ?? []) mine.set(id, (mine.get(id) ?? 0) + n);
                returns.delete(userId);
                if (!(await changeCounts(userId, mine, session))) {
                    const user = await User.findById(me).select('inventory').session(session);
                    const shortId = [...mine].find(([id, n]) => n < 0 && freeCount(user ?? {}, id) < -n)?.[0];
                    const name = shortId && (await Item.findById(shortId).select('name').session(session))?.name;
                    throw new EditRefused(409, `You don't have another ${name ?? 'copy of that item'} to place`);
                }
                await giveBack(returns, session);

                room.set('items', next);
                await room.save({ session });
                return room;
            });
        } catch (e) {
            if (e instanceof EditRefused) {
                res.status(e.status).send({ error: e.message });
            } else if (e instanceof mongoose.Error.ValidationError) {
                res.status(400).send({ error: e.message });
            } else {
                console.log(`Error: ${e}`);
                res.sendStatus(500);
            }
            return;
        }
        res.sendStatus(204);

        try {
            // Footprints, so the room can stand people off furniture (see announceRoomItemsChanged).
            announceRoomItemsChanged(req.app.get('io') as Server, roomId, await roomLayoutOf(room));
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
            const me = new mongoose.Types.ObjectId(userId);
            const friendIds = (await friendIdsOf(userId)).map((id) => new mongoose.Types.ObjectId(id));

            // Group rooms they're in (owners are members too), their own personal room (which has
            // no members, only its owner), and every friend's personal room: those are open to
            // them like a DM. The rooms themselves are the record of who is in them.
            const filter = {
                $or: [
                    { members: me },
                    { owners: me },
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

    // GET /rooms/:roomId/members — everyone in the room, owners first, for anyone who may enter it.
    getMembers: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        try {
            const room = await findAccessibleRoom(roomId, userId, 'personLimit');
            if (sendIfNoAccess(res, room)) return;
            const ownerIds = room.owners.map((id) => id.toString());
            // A personal room has no members; its owner is the only one who belongs to it.
            const ids = isPersonalRoom(room) ? room.owners : room.members;
            // A member whose account was deleted isn't found, and drops out.
            const people = await User.find({ _id: { $in: ids } }).select(PUBLIC_USER_FIELDS).sort({ username: 1 }).lean();
            const members = people.map((u) => ({ ...u, _id: u._id.toString() }) as unknown as PublicUser);
            const rank = (u: PublicUser) => (ownerIds.includes(u._id) ? 0 : 1);
            members.sort((a, b) => rank(a) - rank(b));
            const body: RoomMembers = {
                members,
                ownerIds,
                creatorId: isProtectedCreator(room, room.ownerId.toString()) ? room.ownerId.toString() : null,
                personLimit: room.personLimit,
                canManageMembers: canManageMembers(room, userId),
            };
            res.send(body);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/members { userIds } — an owner adds people to an existing room.
    addMembers: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('owners members personLimit name category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: NO_MEMBERS_IN_PERSONAL_ROOMS });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only room owners can add people' });
                return;
            }
            const already = room.members.map((id) => id.toString());
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
            // The limit and ownership checks are part of the update, so two adds at once can't
            // both pass the limit, and an owner who left a moment ago can't add. Members (owners
            // included) plus the new ones must fit.
            const updated = await Room.findOneAndUpdate(
                {
                    _id: room._id,
                    owners: userId,
                    $expr: { $lte: [{ $add: [{ $size: '$members' }, newIds.length] }, '$personLimit'] },
                },
                { $addToSet: { members: { $each: newIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
            );
            if (!updated) {
                res.status(400).send({ error: `A room holds at most ${room.personLimit} people, you included` });
                return;
            }
            res.sendStatus(204);
            notifyAdded(req, room, newIds);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    /**
     * DELETE /rooms/:roomId/members/:userId — an owner removes someone, other owners included, as in
     * WhatsApp. Not the creator, and not themselves (they leave instead).
     */
    removeMember: async (req: Request, res: Response): Promise<void> => {
        const { roomId, userId: targetId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(targetId)) {
            res.status(404).send({ error: 'Not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('ownerId owners members category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: NO_MEMBERS_IN_PERSONAL_ROOMS });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only room owners can remove people' });
                return;
            }
            if (targetId === userId) {
                res.status(400).send({ error: 'Leave the room instead' });
                return;
            }
            if (isProtectedCreator(room, targetId)) {
                res.status(400).send({ error: "The room's creator can't be removed" });
                return;
            }
            if (!room.members.some((id) => id.toString() === targetId)) {
                res.status(404).send({ error: 'Not a member of this room' });
                return;
            }
            // Checked again in the write: the caller must still own the room, and the target must
            // still be in it and not its creator. Two owners removing each other at once can't
            // both succeed, since the second no longer owns the room, so an owner always remains.
            const { modifiedCount } = await Room.updateOne(
                { _id: room._id, members: targetId, owners: userId, $nor: [{ ownerId: targetId, owners: targetId }] },
                { $pull: { members: targetId, owners: targetId } },
            );
            if (!modifiedCount) {
                res.status(409).send({ error: ROOM_CHANGED });
                return;
            }
            res.sendStatus(204);
            announceMemberRemoved(req.app.get('io') as Server, roomId, targetId, 'removed');
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/owners { userId } — an owner makes a member an owner too.
    addOwner: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const targetId: unknown = req.body?.userId;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        if (typeof targetId !== 'string' || !mongoose.isValidObjectId(targetId)) {
            res.status(400).send({ error: 'Expected a userId' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('owners members category name');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: "A personal room can't have other owners" });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only room owners can make others owners' });
                return;
            }
            if (!room.members.some((id) => id.toString() === targetId)) {
                res.status(404).send({ error: 'Not a member of this room' });
                return;
            }
            if (isRoomOwner(room, targetId)) {
                res.status(400).send({ error: 'Already an owner' });
                return;
            }
            // Checked again in the write, in case the caller or the target left meanwhile.
            const { modifiedCount } = await Room.updateOne(
                { _id: room._id, owners: userId, members: targetId },
                { $addToSet: { owners: targetId } },
            );
            if (!modifiedCount) {
                res.status(409).send({ error: ROOM_CHANGED });
                return;
            }
            res.sendStatus(204);
            notifyNewOwner(req, room, targetId, `${req.user!.username} made you an owner of the room`);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    /**
     * DELETE /rooms/:roomId/owners/:userId — an owner dismisses another owner, who stays in the room
     * as a member (WhatsApp's "Dismiss as admin"). Not the creator, and not themselves.
     */
    dismissOwner: async (req: Request, res: Response): Promise<void> => {
        const { roomId, userId: targetId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(targetId)) {
            res.status(404).send({ error: 'Not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('ownerId owners category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only room owners can dismiss owners' });
                return;
            }
            if (targetId === userId) {
                res.status(400).send({ error: 'Leave the room instead' });
                return;
            }
            if (!isRoomOwner(room, targetId)) {
                res.status(400).send({ error: 'Not an owner' });
                return;
            }
            if (isProtectedCreator(room, targetId)) {
                res.status(400).send({ error: "The room's creator can't be dismissed" });
                return;
            }
            // Checked again in the write. As with removing, two owners dismissing each other at once
            // can't both succeed.
            const { modifiedCount } = await Room.updateOne(
                { _id: room._id, owners: { $all: [userId, targetId] }, ownerId: { $ne: targetId } },
                { $pull: { owners: targetId } },
            );
            if (!modifiedCount) {
                res.status(409).send({ error: ROOM_CHANGED });
                return;
            }
            res.sendStatus(204);
            // Their devices refetch the room, so an edit they have open closes.
            announceOwnersChanged(req.app.get('io') as Server, roomId, [targetId]);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    /**
     * POST /rooms/:roomId/leave — anyone leaves a group room, owners too. When the last owner
     * leaves, a member picked at random owns the room; when the last person leaves, the room is
     * deleted. Answers RoomLeaveResult.
     */
    leave: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        try {
            // Who inherits the room depends on everyone else in it, so the write only lands if
            // owners and members are still what was read. If someone changed them at the same
            // moment (another owner leaving, say), read again and redo it.
            for (let attempt = 0; attempt < LEAVE_ATTEMPTS; attempt++) {
                const room = await Room.findById(roomId).select('owners members category name');
                if (!room) {
                    res.status(404).send({ error: 'Room not found' });
                    return;
                }
                if (isPersonalRoom(room)) {
                    res.status(400).send({ error: "You can't leave your own personal room" });
                    return;
                }
                if (!room.members.some((id) => id.toString() === userId)) {
                    res.status(404).send({ error: 'Not a member of this room' });
                    return;
                }
                const members = room.members.filter((id) => id.toString() !== userId);

                if (members.length === 0) {
                    // The last one out: nobody is left to own the room, so it goes.
                    const deleted = await deleteRoomGivingBack({
                        _id: room._id,
                        members: [new mongoose.Types.ObjectId(userId)],
                    });
                    if (!deleted) continue;
                    await afterRoomDeleted(req, deleted, userId);
                    const result: RoomLeaveResult = { deleted: true };
                    res.send(result);
                    return;
                }

                let owners = room.owners.filter((id) => id.toString() !== userId);
                let newOwnerId: string | undefined;
                if (owners.length === 0) {
                    const heir = members[randomInt(members.length)];
                    owners = [heir];
                    newOwnerId = heir.toString();
                }
                const { modifiedCount } = await Room.updateOne(
                    { _id: room._id, owners: [...room.owners], members: [...room.members] },
                    { $set: { owners, members } },
                );
                if (!modifiedCount) continue;

                const result: RoomLeaveResult = { deleted: false, newOwnerId };
                res.send(result);
                announceMemberRemoved(req.app.get('io') as Server, roomId, userId, 'left');
                if (newOwnerId) notifyNewOwner(req, room, newOwnerId, `${req.user!.username} left, so you now own the room`);
                return;
            }
            res.status(409).send({ error: ROOM_CHANGED });
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // DELETE /rooms/:roomId — an owner deletes a group room for everyone, and its items go back to
    // whoever placed them. Personal rooms stay.
    deleteRoom: async (req: Request, res: Response): Promise<void> => {
        const { roomId } = req.params;
        const userId = req.user!.userId;
        if (!mongoose.isValidObjectId(roomId)) {
            res.status(404).send({ error: 'Room not found' });
            return;
        }
        try {
            const room = await Room.findById(roomId).select('owners category');
            if (!room) {
                res.status(404).send({ error: 'Room not found' });
                return;
            }
            if (isPersonalRoom(room)) {
                res.status(400).send({ error: "Your personal room can't be deleted" });
                return;
            }
            if (!canManageMembers(room, userId)) {
                res.status(403).send({ error: 'Only room owners can delete the room' });
                return;
            }
            // Ownership is checked again in the delete, and who to tell is read from the room as it
            // was deleted, so someone added a moment before is told too.
            const deleted = await deleteRoomGivingBack({
                _id: room._id,
                category: RoomCategory.GROUP,
                owners: userId,
            });
            if (!deleted) {
                res.status(409).send({ error: ROOM_CHANGED });
                return;
            }
            await afterRoomDeleted(req, deleted, userId);
            res.sendStatus(204);
        } catch (e) {
            console.log(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
