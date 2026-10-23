import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { Server } from 'socket.io';
import { ROOM_MAIL_MAX_LENGTH, type PublicUser, type RoomMail, type RoomMailbox } from '@chat-app/shared-types';
import Room, { IRoom } from '../models/room.model';
import { MailboxRead, RoomMail as RoomMailModel, IRoomMail } from '../models/room-mail.model';
import { PUBLIC_USER_FIELDS } from '../models/user.model';
import { sendPushToUsers } from '../services/notification.service';
import { findAccessibleRoom, isPersonalRoom } from '../services/room-access.service';
import { announceRoomMail } from '../sockets/socketHandler';
import { roomPresence } from '../sockets/roomPresence';
import { sendIfNoAccess } from './room.controller';

/** Most mails one fetch returns, newest first. */
const MAILBOX_LIMIT = 50;
/** Longest stretch of a mail's text put in its push. */
const PUSH_PREVIEW_LENGTH = 100;

type MailRoom = Pick<IRoom, '_id' | 'ownerId' | 'members' | 'category'>;

function isOwner(room: MailRoom, userId: string): boolean {
    return room.ownerId.toString() === userId;
}

/**
 * The mail the user may read. A personal room's postbox is its owner's inbox: they read it all,
 * and each visitor reads only what they wrote. A group room's postbox is shared by everyone in it.
 */
function visibleTo(room: MailRoom, userId: string): Record<string, unknown> {
    if (isPersonalRoom(room) && !isOwner(room, userId)) return { roomId: room._id, authorId: userId };
    return { roomId: room._id };
}

/** The owner doesn't post in their own personal room: it would be a note to themselves. */
function canPost(room: MailRoom, userId: string): boolean {
    return !(isPersonalRoom(room) && isOwner(room, userId));
}

/** Who reads a new mail in this room, other than its author. */
function readersOf(room: MailRoom, authorId: string): string[] {
    const readers = isPersonalRoom(room) ? [room.ownerId] : [room.ownerId, ...room.members];
    return [...new Set(readers.map((id) => id.toString()))].filter((id) => id !== authorId);
}

/** A mail with its author populated, as the client gets it. */
function toRoomMail(mail: IRoomMail): RoomMail {
    return {
        _id: mail._id.toString(),
        roomId: mail.roomId.toString(),
        author: mail.authorId as unknown as PublicUser,
        text: mail.text,
        createdAt: mail.createdAt,
    };
}

const controller = {
    // GET /rooms/:roomId/mail — the postbox as the caller sees it, with their unread count.
    getMailbox: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        try {
            const room = await findAccessibleRoom(req.params.roomId, userId, '');
            if (sendIfNoAccess(res, room)) return;
            const filter = visibleTo(room, userId);
            const [mails, read] = await Promise.all([
                RoomMailModel.find(filter)
                    .sort({ createdAt: -1 })
                    .limit(MAILBOX_LIMIT)
                    .populate('authorId', PUBLIC_USER_FIELDS),
                MailboxRead.findOne({ userId, roomId: room._id }).select('readAt'),
            ]);
            // A visitor to a personal room only sees their own mail, so nothing there is unread.
            const unread = 'authorId' in filter ? 0 : await RoomMailModel.countDocuments({
                roomId: room._id,
                authorId: { $ne: userId },
                ...(read ? { createdAt: { $gt: read.readAt } } : {}),
            });
            const body: RoomMailbox = {
                // A mail whose author's account was deleted populates as null.
                mails: mails.filter((m) => m.authorId).map(toRoomMail),
                unread,
                canPost: canPost(room, userId),
            };
            res.send(body);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/mail { text } — leave a mail. Its readers are told, and pushed unless they're in the room.
    postMail: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        if (!text || text.length > ROOM_MAIL_MAX_LENGTH) {
            res.status(400).send({ error: `Write between 1 and ${ROOM_MAIL_MAX_LENGTH} characters` });
            return;
        }
        try {
            const room = await findAccessibleRoom(req.params.roomId, userId, 'name');
            if (sendIfNoAccess(res, room)) return;
            if (!canPost(room, userId)) {
                res.status(400).send({ error: "You can't leave mail in your own room" });
                return;
            }
            const mail = await RoomMailModel.create({ roomId: room._id, authorId: userId, text });
            await mail.populate('authorId', PUBLIC_USER_FIELDS);
            res.status(201).send(toRoomMail(mail));

            const roomId = room._id.toString();
            const username = req.user!.username;
            const readers = readersOf(room, userId);
            announceRoomMail(req.app.get('io') as Server, readers, { roomId, roomName: room.name, username });
            const away = readers.filter((id) => !roomPresence.has(roomId, id));
            const preview = text.length > PUSH_PREVIEW_LENGTH ? `${text.slice(0, PUSH_PREVIEW_LENGTH)}…` : text;
            sendPushToUsers(
                away,
                { title: room.name, body: `${username} left a mail: ${preview}`, type: 'mail' },
                { roomId, senderUserId: userId },
            );
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // POST /rooms/:roomId/mail/read — the caller opened the postbox: everything in it so far is read.
    markRead: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        try {
            const room = await findAccessibleRoom(req.params.roomId, userId, '');
            if (sendIfNoAccess(res, room)) return;
            await MailboxRead.updateOne(
                { userId, roomId: room._id },
                { $set: { readAt: new Date() } },
                { upsert: true },
            );
            res.sendStatus(204);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },

    // DELETE /rooms/:roomId/mail/:mailId — its author or the room's owner deletes a mail.
    deleteMail: async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.userId;
        const { roomId, mailId } = req.params;
        if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(mailId)) {
            res.status(404).send({ error: 'Mail not found' });
            return;
        }
        try {
            const mail = await RoomMailModel.findOne({ _id: mailId, roomId }).select('authorId');
            if (!mail) {
                res.status(404).send({ error: 'Mail not found' });
                return;
            }
            if (mail.authorId.toString() !== userId && !(await Room.exists({ _id: roomId, ownerId: userId }))) {
                res.status(403).send({ error: 'Only its author or the room owner can delete this' });
                return;
            }
            await RoomMailModel.deleteOne({ _id: mailId });
            res.sendStatus(204);
        } catch (e) {
            console.error(`Error: ${e}`);
            res.sendStatus(500);
        }
    },
};

export default controller;
