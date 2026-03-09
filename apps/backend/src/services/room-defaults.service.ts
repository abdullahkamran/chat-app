import mongoose from 'mongoose';
import ItemModel from '../models/item.model';
import { ROOM_DEFAULTS_CATALOG } from '../catalog/room-defaults.catalog';

export interface ResolvedRoomDefaults {
    personLimit: number;
    theme: {
        floor: mongoose.Types.ObjectId | null;
        leftWall: mongoose.Types.ObjectId | null;
        rightWall: mongoose.Types.ObjectId | null;
    };
    doors: typeof ROOM_DEFAULTS_CATALOG.doors;
}

/**
 * Resolves mandatory room defaults by looking up theme item IDs from the DB.
 * Pass overrides to let the room creator override specific defaults (e.g. personLimit).
 */
export async function resolveRoomDefaults(overrides: { personLimit?: number } = {}): Promise<ResolvedRoomDefaults> {
    const { theme: themeNames, doors } = ROOM_DEFAULTS_CATALOG;
    const personLimit = overrides.personLimit ?? ROOM_DEFAULTS_CATALOG.personLimit;

    const uniqueNames = [...new Set([
        themeNames.floorItemName,
        themeNames.leftWallItemName,
        themeNames.rightWallItemName,
    ])];

    const items = await ItemModel.find({ name: { $in: uniqueNames } }).select('_id name');

    const findId = (name: string): mongoose.Types.ObjectId | null =>
        (items.find(i => i.name === name)?._id as mongoose.Types.ObjectId) ?? null;

    const missingNames = uniqueNames.filter(n => !items.find(i => i.name === n));
    if (missingNames.length) {
        console.warn('[room-defaults] Theme items not found in DB:', missingNames);
    }

    return {
        personLimit,
        theme: {
            floor: findId(themeNames.floorItemName),
            leftWall: findId(themeNames.leftWallItemName),
            rightWall: findId(themeNames.rightWallItemName),
        },
        doors,
    };
}
