import mongoose from 'mongoose';
import { RoomCategory } from '@chat-app/shared-types';
import { SIGNUP_DEFAULTS } from '../config/signup-defaults.config';
import RoomModel, { IRoom } from '../models/room.model';
import User from '../models/user.model';
import { resolveRoomDefaults } from './room-defaults.service';

/** A Mongo duplicate-key error: here, the user's personal room was created meanwhile. */
function isDuplicateKey(e: unknown): boolean {
    return (e as { code?: number })?.code === 11000;
}

/**
 * Create the user's personal room, or return the one they already have. The unique index on
 * personal rooms' `ownerId` (room.model.ts) means two calls at once still make only one.
 * Throws when the room can't be made: signup treats that as a failed signup.
 */
export async function createPersonalRoom(userId: mongoose.Types.ObjectId, username: string): Promise<IRoom> {
    let room = await RoomModel.findOne({ ownerId: userId, category: RoomCategory.PERSONAL });
    if (!room) {
        const { description, dimensions } = SIGNUP_DEFAULTS.defaultRoom;
        const roomDefaults = await resolveRoomDefaults();
        try {
            room = await new RoomModel({
                ownerId: userId,
                name: `${username}'s Room`,
                description,
                category: RoomCategory.PERSONAL,
                dimensions,
                ...roomDefaults,
            }).save();
        } catch (e) {
            if (!isDuplicateKey(e)) throw e;
            room = await RoomModel.findOne({ ownerId: userId, category: RoomCategory.PERSONAL });
            if (!room) throw e;
        }
    }
    await User.updateOne({ _id: userId }, { $addToSet: { ownedRooms: room._id } });
    return room;
}
