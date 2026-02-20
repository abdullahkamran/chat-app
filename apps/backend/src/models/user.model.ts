import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    username: string;
    rooms: mongoose.Types.ObjectId[];
    pushTokens: string[];
}

interface IUserModel extends Model<IUser> {
    getAll(): Promise<IUser[]>;
    addUser(user: IUser): Promise<IUser>;
    deleteByID(user: { _id: mongoose.Types.ObjectId }): Promise<mongoose.mongo.DeleteResult>;
}

const UserSchema = new Schema<IUser, IUserModel>(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
        pushTokens: [{ type: String }],
    },
    { collection: 'users' }
);

UserSchema.statics.getAll = function () {
    return this.find({});
};

UserSchema.statics.addUser = function (user: IUser) {
    return user.save();
};

UserSchema.statics.deleteByID = function (user: { _id: mongoose.Types.ObjectId }) {
    return this.deleteOne({ _id: user._id });
};

const UserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);

export default UserModel;
