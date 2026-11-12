import mongoose from 'mongoose';
import ItemModel from '../models/item.model';
import RoomModel from '../models/room.model';
import { DEFAULT_ENTRY_DOOR } from '@chat-app/shared-types';
import { ROOM_DEFAULTS_CATALOG } from '../catalog/room-defaults.catalog';

export interface ResolvedRoomDefaults {
    personLimit: number;
    dimensions: { x: number; y: number; z: number };
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
        dimensions: { ...ROOM_DEFAULTS_CATALOG.dimensions },
        theme: {
            floor: findId(themeNames.floorItemName),
            leftWall: findId(themeNames.leftWallItemName),
            rightWall: findId(themeNames.rightWallItemName),
        },
        doors,
    };
}

/**
 * Gives rooms saved without a floor size the default one. Group rooms used to be created
 * without `dimensions`, so they were stored as 0×0 and the server had no floor to place
 * people on. Idempotent, so it's safe on every boot and on several instances at once.
 */
export async function backfillRoomDimensions(): Promise<void> {
    const { modifiedCount } = await RoomModel.updateMany(
        { $or: [{ 'dimensions.x': { $not: { $gt: 0 } } }, { 'dimensions.y': { $not: { $gt: 0 } } }] },
        { $set: { dimensions: ROOM_DEFAULTS_CATALOG.dimensions } },
    );
    if (modifiedCount) console.log(`[room-defaults] gave ${modifiedCount} room(s) the default dimensions`);
}

/**
 * Moves the default entry door rooms got before 2026-11-12 (left wall, row 4, two rows tall) to
 * where DEFAULT_ENTRY_DOOR stands now. Only that exact door changes, so a door someone placed
 * stays. Idempotent, so it's safe on every boot and on several instances at once.
 */
export async function backfillEntryDoor(): Promise<void> {
    const old = { 'd.isEntry': true, 'd.category': 'default', 'd.position.x': 0, 'd.position.y': 4, 'd.dimensions.z': 2 };
    const { modifiedCount } = await RoomModel.updateMany(
        { doors: { $elemMatch: { isEntry: true, category: 'default', 'position.x': 0, 'position.y': 4, 'dimensions.z': 2 } } },
        { $set: { 'doors.$[d].position': DEFAULT_ENTRY_DOOR.position, 'doors.$[d].dimensions': DEFAULT_ENTRY_DOOR.dimensions } },
        { arrayFilters: [old] },
    );
    if (modifiedCount) console.log(`[room-defaults] moved the entry door in ${modifiedCount} room(s)`);
}
