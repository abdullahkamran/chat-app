import mongoose from 'mongoose';
import { RoomCategory } from '@chat-app/shared-types';
import Room, { IRoom } from '../models/room.model';
import { areFriends } from './friend.service';

export type AccessRoom = Pick<IRoom, '_id' | 'ownerId' | 'members' | 'category'>;

/** The fields `canAccessRoom` reads, for `select`. */
export const ROOM_ACCESS_FIELDS = 'ownerId members category';

export function isPersonalRoom(room: Pick<IRoom, 'category'>): boolean {
    return room.category === RoomCategory.PERSONAL;
}

/**
 * Whether the user may enter the room, see it and use its postbox. A group room is open to its owner
 * and members. A personal room has no members: it is open to its owner and their friends.
 */
export async function canAccessRoom(room: AccessRoom, userId: string): Promise<boolean> {
    const ownerId = room.ownerId.toString();
    if (ownerId === userId) return true;
    if (isPersonalRoom(room)) return areFriends(ownerId, userId);
    return room.members.some((id) => id.toString() === userId);
}

/**
 * The room when the user may access it. `null` when it doesn't exist and `false` when they may
 * not, so routes can answer 404 or 403. `select` names fields to load besides the ones the check
 * needs; leave it out to load the whole room.
 */
export async function findAccessibleRoom(roomId: unknown, userId: string, select?: string): Promise<IRoom | null | false> {
    if (typeof roomId !== 'string' || !mongoose.isValidObjectId(roomId)) return null;
    const query = Room.findById(roomId);
    if (select !== undefined) query.select(`${ROOM_ACCESS_FIELDS} ${select}`.trim());
    const room = await query;
    if (!room) return null;
    return (await canAccessRoom(room, userId)) ? room : false;
}
