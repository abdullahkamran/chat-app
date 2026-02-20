import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRoom extends Document {
    name: string;
    owners: mongoose.Types.ObjectId[];
    members: mongoose.Types.ObjectId[];
}

interface IRoomModel extends Model<IRoom> {
    getAll(): Promise<IRoom[]>;
    addRoom(room: IRoom): Promise<IRoom>;
    deleteByID(room: { _id: mongoose.Types.ObjectId }): Promise<mongoose.mongo.DeleteResult>;
}

const RoomSchema = new Schema<IRoom, IRoomModel>(
    {
        name: { type: String, required: true },
        owners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true, collection: 'rooms' }
);

RoomSchema.statics.getAll = function () {
    return this.find({});
};

RoomSchema.statics.addRoom = function (room: IRoom) {
    return room.save();
};

RoomSchema.statics.deleteByID = function (room: { _id: mongoose.Types.ObjectId }) {
    return this.deleteOne({ _id: room._id });
};

const RoomModel = mongoose.model<IRoom, IRoomModel>('Room', RoomSchema);

export default RoomModel;
