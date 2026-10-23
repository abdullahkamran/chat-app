import mongoose, { Document, Schema } from 'mongoose';
import { FriendshipStatus } from '@chat-app/shared-types';

/**
 * One relationship between two users: a pending friend request, or a friendship once accepted.
 * There is at most one per pair (`pairKey`), so accepting is a single write, and two people
 * requesting each other at the same moment can't create two.
 */
export interface IFriendship extends Document {
    requester: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    status: FriendshipStatus;
    /** Both user IDs, sorted and joined: the same for either direction. */
    pairKey: string;
    acceptedAt: Date | null;
    createdAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
    {
        requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: Object.values(FriendshipStatus), required: true },
        pairKey: { type: String, required: true, unique: true },
        acceptedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: 'friendships' }
);

// A user's friends (either side) and their incoming requests.
FriendshipSchema.index({ requester: 1, status: 1 });
FriendshipSchema.index({ recipient: 1, status: 1 });

/** The `pairKey` for two users, whichever asked. */
export function pairKeyOf(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The other user in a friendship, seen from `userId`. */
export function otherUserOf(f: Pick<IFriendship, 'requester' | 'recipient'>, userId: string): string {
    const requester = f.requester.toString();
    return requester === userId ? f.recipient.toString() : requester;
}

const FriendshipModel = mongoose.model<IFriendship>('Friendship', FriendshipSchema);

export default FriendshipModel;
