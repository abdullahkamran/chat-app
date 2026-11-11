import mongoose, { ClientSession } from 'mongoose';
import Room from '../models/room.model';
import User from '../models/user.model';

/**
 * Room items are real copies. A user's inventory (`User.inventory`, item ID → count) holds the
 * copies free to place; placing one in a room moves it there (the room item's `placedBy`), and
 * taking it out of the room, whoever does it, moves it back to `placedBy`'s inventory.
 * Wallpapers and floorings are the exception: they dress a room without leaving the inventory.
 */

type Id = string | mongoose.Types.ObjectId;

/** The update path of one item's count. */
export function inventoryPath(itemId: Id): string {
    return `inventory.${itemId.toString()}`;
}

/** Copies of `itemId` free to place. */
export function freeCount(user: { inventory?: Map<string, number> | null }, itemId: Id): number {
    return user.inventory?.get(itemId.toString()) ?? 0;
}

/** Item ID → how many copies `userId` has standing in rooms (all rooms, or those of `itemIds`). */
export async function placedCounts(userId: Id, itemIds?: Id[]): Promise<Map<string, number>> {
    const placer = new mongoose.Types.ObjectId(userId.toString());
    const match: Record<string, unknown> = { 'items.placedBy': placer };
    if (itemIds) match['items.itemId'] = { $in: itemIds.map((id) => new mongoose.Types.ObjectId(id.toString())) };
    const rows = await Room.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
        { $match: { 'items.placedBy': placer } },
        { $unwind: '$items' },
        { $match: match },
        { $group: { _id: '$items.itemId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r.n]));
}

/** userId → itemId → copies: what to give back to whom. */
export type Returns = Map<string, Map<string, number>>;

export function addReturn(returns: Returns, userId: Id, itemId: Id, n = 1): void {
    const user = userId.toString();
    const counts = returns.get(user) ?? new Map<string, number>();
    counts.set(itemId.toString(), (counts.get(itemId.toString()) ?? 0) + n);
    returns.set(user, counts);
}

/** Puts copies back into their placers' inventories (positive counts only). */
export async function giveBack(returns: Returns, session?: ClientSession): Promise<void> {
    const ops = [...returns].flatMap(([userId, counts]) => {
        const inc: Record<string, number> = {};
        for (const [itemId, n] of counts) if (n > 0) inc[inventoryPath(itemId)] = n;
        return Object.keys(inc).length
            ? [{ updateOne: { filter: { _id: new mongoose.Types.ObjectId(userId) }, update: { $inc: inc } } }]
            : [];
    });
    if (ops.length) await User.bulkWrite(ops, { session });
}

/**
 * Changes one user's counts by `deltas` (item ID → change) in a single update, which only applies
 * if every count taken from has enough. Returns false, changing nothing, when one hasn't.
 */
export async function changeCounts(userId: Id, deltas: Map<string, number>, session?: ClientSession): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: new mongoose.Types.ObjectId(userId.toString()) };
    const inc: Record<string, number> = {};
    for (const [itemId, n] of deltas) {
        if (n === 0) continue;
        inc[inventoryPath(itemId)] = n;
        if (n < 0) filter[inventoryPath(itemId)] = { $gte: -n };
    }
    if (!Object.keys(inc).length) return true;
    const { matchedCount } = await User.updateOne(filter, { $inc: inc }, { session });
    return matchedCount > 0;
}
