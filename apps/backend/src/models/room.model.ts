import mongoose, { Document, Model, Schema } from 'mongoose';
import { Room, RoomDetails } from '@chat-app/shared-types';
import { Orientiation, ItemState, RoomCategory } from '@chat-app/shared-types';

// Override ownerId to use ObjectId since mongoose stores a reference, not a plain string
export interface IRoom extends Omit<Room, '_id' | 'ownerId'>, Omit<RoomDetails, '_id' | 'ownerId' | 'members' | 'items' | 'theme'>, Document {
    ownerId: mongoose.Types.ObjectId;
    members: mongoose.Types.ObjectId[];
    items: Array<{
        itemId: mongoose.Types.ObjectId;
        position: { x: number; y: number; z: number };
        orientation: string;
        state: string;
    }>;
    theme: {
        floor: mongoose.Types.ObjectId | null;
        leftWall: mongoose.Types.ObjectId | null;
        rightWall: mongoose.Types.ObjectId | null;
    };
}

interface IRoomModel extends Model<IRoom> {
    getAll(): Promise<IRoom[]>;
    createRoom(room: IRoom): Promise<IRoom>;
    deleteByID(room: { _id: mongoose.Types.ObjectId }): Promise<mongoose.mongo.DeleteResult>;
}

const RoomSchema = new Schema<IRoom, IRoomModel>(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        category: { type: String, enum: Object.values(RoomCategory), default: RoomCategory.GROUP },
        personLimit: { type: Number, default: 10 },
        members: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            validate: {
                validator(this: IRoom, members: unknown[]) {
                    return this.category !== RoomCategory.PERSONAL || members.length === 0;
                },
                message: "Personal rooms don't have members",
            },
        },
        dimensions: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            z: { type: Number, default: 0 },
        },
        items: [
            {
                itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
                position: {
                    x: { type: Number, default: 0 },
                    y: { type: Number, default: 0 },
                    z: { type: Number, default: 0 },
                },
                orientation: { type: String, enum: Object.values(Orientiation), default: Orientiation.ZERO },
                state: { type: String, enum: Object.values(ItemState), default: ItemState.NONE },
            },
        ],
        doors: [
            {
                position: {
                    x: { type: Number, default: 0 },
                    y: { type: Number, default: 0 },
                    z: { type: Number, default: 0 },
                },
                dimensions: {
                    x: { type: Number, default: 0 },
                    y: { type: Number, default: 0 },
                    z: { type: Number, default: 0 },
                },
                category: { type: String, default: '' },
                isEntry: { type: Boolean, default: false },
            },
        ],
        theme: {
            floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
            leftWall: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
            rightWall: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
        },
    },
    { timestamps: true, collection: 'rooms' }
);

// One personal room per user. A second create for the same owner (say a retried signup)
// fails with a duplicate key instead of making another.
RoomSchema.index(
    { ownerId: 1 },
    { unique: true, partialFilterExpression: { category: RoomCategory.PERSONAL }, name: 'one_personal_room_per_owner' },
);

RoomSchema.statics.getAll = function () {
    return this.find({});
};

RoomSchema.statics.createRoom = function (room: IRoom) {
    return room.save();
};

// Never deletes a personal room: every user keeps exactly one.
RoomSchema.statics.deleteByID = function (room: { _id: mongoose.Types.ObjectId }) {
    return this.deleteOne({ _id: room._id, category: { $ne: RoomCategory.PERSONAL } });
};

/**
 * Whether the user may add and remove the room's members. Only the owner today, and never in a
 * personal room, which has no members. Room admins, when they come, are checked here, so the
 * routes that call this don't change.
 */
export function canManageMembers(room: Pick<IRoom, 'ownerId' | 'category'>, userId: string): boolean {
    return room.category !== RoomCategory.PERSONAL && room.ownerId.toString() === userId;
}

const RoomModel = mongoose.model<IRoom, IRoomModel>('Room', RoomSchema);

export default RoomModel;
