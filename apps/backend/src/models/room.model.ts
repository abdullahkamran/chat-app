import mongoose, { Document, Model, Schema } from 'mongoose';
import { Room, RoomDetails } from '@chat-app/shared-types';
import { Orientiation, ItemState } from '@chat-app/shared-types';

// Override ownerId to use ObjectId since mongoose stores a reference, not a plain string
export interface IRoom extends Omit<Room, '_id' | 'ownerId'>, Omit<RoomDetails, '_id' | 'ownerId' | 'users' | 'items' | 'theme'>, Document {
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
        category: { type: String, default: '' },
        personLimit: { type: Number, default: 10 },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        dimensions: {
            length: { type: Number, default: 0 },
            width: { type: Number, default: 0 },
            height: { type: Number, default: 0 },
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
        door: [
            {
                position: {
                    x: { type: Number, default: 0 },
                    y: { type: Number, default: 0 },
                    z: { type: Number, default: 0 },
                },
                dimensions: {
                    length: { type: Number, default: 0 },
                    width: { type: Number, default: 0 },
                    height: { type: Number, default: 0 },
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

RoomSchema.statics.getAll = function () {
    return this.find({});
};

RoomSchema.statics.createRoom = function (room: IRoom) {
    return room.save();
};

RoomSchema.statics.deleteByID = function (room: { _id: mongoose.Types.ObjectId }) {
    return this.deleteOne({ _id: room._id });
};

const RoomModel = mongoose.model<IRoom, IRoomModel>('Room', RoomSchema);

export default RoomModel;
