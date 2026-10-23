import { FriendshipStatus, type FriendRelation, type FriendSuggestion } from '@chat-app/shared-types';
import Friendship, { otherUserOf, pairKeyOf } from '../models/friendship.model';
import Room from '../models/room.model';
import User, { PUBLIC_USER_FIELDS } from '../models/user.model';

/** Most people Quick Add shows. */
const SUGGESTION_LIMIT = 30;
/** Most friendships read when counting mutual friends, so a user with many friends can't make this slow. */
const FRIENDS_OF_FRIENDS_SCAN = 5000;

/** IDs of the user's accepted friends. */
export async function friendIdsOf(userId: string): Promise<string[]> {
    const friendships = await Friendship.find({
        status: FriendshipStatus.ACCEPTED,
        $or: [{ requester: userId }, { recipient: userId }],
    }).select('requester recipient');
    return friendships.map((f) => otherUserOf(f, userId));
}

/** How each of `otherIds` relates to the user. Anyone missing from the map is 'none'. */
export async function relationsWith(userId: string, otherIds: string[]): Promise<Map<string, FriendRelation>> {
    const relations = new Map<string, FriendRelation>();
    if (otherIds.length === 0) return relations;
    const friendships = await Friendship.find({ pairKey: { $in: otherIds.map((id) => pairKeyOf(userId, id)) } })
        .select('requester recipient status');
    for (const f of friendships) {
        const relation: FriendRelation = f.status === FriendshipStatus.ACCEPTED
            ? 'friends'
            : f.requester.toString() === userId ? 'requested' : 'incoming';
        relations.set(otherUserOf(f, userId), relation);
    }
    return relations;
}

/** Which of `otherIds` are not the user's accepted friends. */
export async function notFriendsAmong(userId: string, otherIds: string[]): Promise<string[]> {
    if (otherIds.length === 0) return [];
    const friends = await Friendship.find({
        status: FriendshipStatus.ACCEPTED,
        pairKey: { $in: otherIds.map((id) => pairKeyOf(userId, id)) },
    }).select('requester recipient');
    const friendIds = new Set(friends.map((f) => otherUserOf(f, userId)));
    return otherIds.filter((id) => !friendIds.has(id));
}

/** Whether two users are accepted friends. */
export async function areFriends(a: string, b: string): Promise<boolean> {
    return !!(await Friendship.exists({ pairKey: pairKeyOf(a, b), status: FriendshipStatus.ACCEPTED }));
}

/**
 * Quick Add for the user: people in their contacts (who allow it), friends of their friends,
 * and people they share rooms with. Leaves out friends, people who sent them a request (those
 * are under Added Me), and anyone they dismissed. People they already requested stay, shown as
 * requested. Ranked by contacts, then mutual friends, then shared rooms.
 */
export async function suggestionsFor(userId: string): Promise<FriendSuggestion[]> {
    const me = await User.findById(userId).select('rooms ownedRooms contactMatches dismissedSuggestions');
    if (!me) return [];

    const mine = await Friendship.find({ $or: [{ requester: userId }, { recipient: userId }] })
        .select('requester recipient status');
    const friendIds = new Set<string>();
    const requested = new Set<string>();
    const excluded = new Set<string>([userId, ...me.dismissedSuggestions.map((id) => id.toString())]);
    for (const f of mine) {
        const other = otherUserOf(f, userId);
        if (f.status === FriendshipStatus.ACCEPTED) friendIds.add(other);
        else if (f.requester.toString() === userId) requested.add(other);
        else excluded.add(other);
    }
    for (const id of friendIds) excluded.add(id);

    const reasons = new Map<string, { inContacts: boolean; mutualFriends: number; sharedRooms: number }>();
    const reasonFor = (id: string) => {
        let r = reasons.get(id);
        if (!r) {
            r = { inContacts: false, mutualFriends: 0, sharedRooms: 0 };
            reasons.set(id, r);
        }
        return r;
    };

    for (const id of me.contactMatches) reasonFor(id.toString()).inContacts = true;

    if (friendIds.size) {
        const ids = [...friendIds];
        const ofFriends = await Friendship.find({
            status: FriendshipStatus.ACCEPTED,
            $or: [{ requester: { $in: ids } }, { recipient: { $in: ids } }],
        }).select('requester recipient').limit(FRIENDS_OF_FRIENDS_SCAN);
        for (const f of ofFriends) {
            const a = f.requester.toString();
            const b = f.recipient.toString();
            if (friendIds.has(a)) reasonFor(b).mutualFriends++;
            if (friendIds.has(b)) reasonFor(a).mutualFriends++;
        }
    }

    const rooms = await Room.find({ _id: { $in: [...me.rooms, ...me.ownedRooms] } }).select('ownerId members');
    for (const room of rooms) {
        for (const id of [room.ownerId, ...room.members]) reasonFor(id.toString()).sharedRooms++;
    }

    const candidates = [...reasons.keys()].filter((id) => !excluded.has(id));
    if (candidates.length === 0) return [];
    const users = await User.find({ _id: { $in: candidates } }).select(`${PUBLIC_USER_FIELDS} discoverableByPhone`).lean();

    const suggestions: FriendSuggestion[] = [];
    for (const u of users) {
        const id = u._id.toString();
        const reason = reasons.get(id)!;
        // Someone who turned off being found by number isn't suggested from contacts.
        const inContacts = reason.inContacts && u.discoverableByPhone !== false;
        if (!inContacts && !reason.mutualFriends && !reason.sharedRooms) continue;
        suggestions.push({
            _id: id,
            username: u.username,
            level: u.level,
            relation: requested.has(id) ? 'requested' : 'none',
            ...reason,
            inContacts,
        });
    }
    suggestions.sort((a, b) =>
        Number(b.inContacts) - Number(a.inContacts)
        || b.mutualFriends - a.mutualFriends
        || b.sharedRooms - a.sharedRooms
        || a.username.localeCompare(b.username));
    return suggestions.slice(0, SUGGESTION_LIMIT);
}
