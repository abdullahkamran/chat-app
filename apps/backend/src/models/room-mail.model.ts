import mongoose, { Document, Schema } from 'mongoose';
import { ROOM_MAIL_MAX_LENGTH } from '@chat-app/shared-types';

/** A note left in a room's postbox. Kept until its author or the room owner deletes it. */
export interface IRoomMail extends Document {
    roomId: mongoose.Types.ObjectId;
    authorId: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
}

const RoomMailSchema = new Schema<IRoomMail>(
    {
        roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
        authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, maxlength: ROOM_MAIL_MAX_LENGTH },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'room_mails' }
);

// A room's postbox, newest first; and a visitor's own mail in a personal room.
RoomMailSchema.index({ roomId: 1, createdAt: -1 });
RoomMailSchema.index({ roomId: 1, authorId: 1, createdAt: -1 });

export const RoomMail = mongoose.model<IRoomMail>('RoomMail', RoomMailSchema);

/** When a user last opened a room's postbox. Mail from others after this is unread. */
export interface IMailboxRead extends Document {
    userId: mongoose.Types.ObjectId;
    roomId: mongoose.Types.ObjectId;
    readAt: Date;
}

const MailboxReadSchema = new Schema<IMailboxRead>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
        readAt: { type: Date, required: true },
    },
    { collection: 'mailbox_reads' }
);

MailboxReadSchema.index({ userId: 1, roomId: 1 }, { unique: true });

export const MailboxRead = mongoose.model<IMailboxRead>('MailboxRead', MailboxReadSchema);
