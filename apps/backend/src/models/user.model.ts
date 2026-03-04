import mongoose, { Document, Model, Schema } from 'mongoose';
import { User } from '@chat-app/shared-types';

// Override ref-array fields with ObjectId since mongoose stores references, not populated docs
export interface IUser
    extends Omit<User, '_id' | 'rooms' | 'ownedRooms' | 'favouriteRooms' | 'friends' | 'inventory' | 'avatarInventory' | 'avatars' | 'selectedAvatar' | 'animations'>,
        Document {
    rooms: mongoose.Types.ObjectId[];
    ownedRooms: mongoose.Types.ObjectId[];
    favouriteRooms: mongoose.Types.ObjectId[];
    friends: mongoose.Types.ObjectId[];
    inventory: mongoose.Types.ObjectId[];
    avatarInventory: Array<{ item: mongoose.Types.ObjectId; variantId: string }>;
    avatars: mongoose.Types.ObjectId[];
    selectedAvatar: mongoose.Types.ObjectId | null;
    animations: mongoose.Types.ObjectId[];
    pushTokens: string[];    // backend-only, for push notifications
    refreshTokens: string[]; // backend-only, for auth session management
}

interface IUserModel extends Model<IUser> {
    getAll(): Promise<IUser[]>;
    createUser(user: IUser): Promise<IUser>;
    deleteByID(user: { _id: mongoose.Types.ObjectId }): Promise<mongoose.mongo.DeleteResult>;
}

const UserSchema = new Schema<IUser, IUserModel>(
    {
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phoneNumber: { type: String, required: true, unique: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        lastLogin: { type: Number, default: 0 },
        lastActive: { type: Number, default: 0 },
        lastLocation: {
            x: { type: String, default: '0' },
            y: { type: String, default: '0' },
            z: { type: String, default: '0' },
        },
        avatars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Avatar' }],
        selectedAvatar: { type: mongoose.Schema.Types.ObjectId, ref: 'Avatar', default: null },
        mood: { type: String, default: '' },
        level: { type: Number, default: 1 },
        animations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animation' }],
        attributes: {
            speed: { type: Number, default: 1 },
            maxSpeed: { type: Number, default: 5 },
            bubbleDuration: { type: Number, default: 3000 },
            maxBubbleDuration: { type: Number, default: 10000 },
        },
        amount: {
            coins: { type: Number, default: 0 },
            cash: { type: Number, default: 0 },
            realMoney: { type: Number, default: 0 },
        },
        respecc: { type: Number, default: 0 },
        popularity: { type: Number, default: 0 },
        drip: { type: Number, default: 0 },
        maxRooms: { type: Number, default: 5 },
        rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
        ownedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
        favouriteRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        inventory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
        avatarInventory: [
            {
                item: { type: mongoose.Schema.Types.ObjectId, ref: 'AvatarItem', required: true },
                variantId: { type: String, required: true },
            },
        ],
        badges: [
            {
                rizz: { type: Number, default: 0 },
                simp: { type: Number, default: 0 },
                delulu: { type: Number, default: 0 },
                goat: { type: Number, default: 0 },
                sus: { type: Number, default: 0 },
            },
        ],
        pushTokens: [{ type: String }],
        refreshTokens: [{ type: String }],
    },
    {
        collection: 'users',
        toJSON: {
            transform: (_doc, ret: Record<string, unknown>) => {
                delete ret.password;
                delete ret.refreshTokens;
                delete ret.pushTokens;
                return ret;
            },
        },
    }
);

UserSchema.statics.getAll = function () {
    return this.find({});
};

UserSchema.statics.createUser = function (user: IUser) {
    return user.save();
};

UserSchema.statics.deleteByID = function (user: { _id: mongoose.Types.ObjectId }) {
    return this.deleteOne({ _id: user._id });
};

const UserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);

export default UserModel;
