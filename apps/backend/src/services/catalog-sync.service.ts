import bcrypt from 'bcryptjs';
import AnimationModel from '../models/animation.model';
import AvatarItemModel from '../models/avatar-item.model';
import ItemModel from '../models/item.model';
import UserModel from '../models/user.model';
import { ANIMATIONS_CATALOG } from '../catalog/animations.catalog';
import { AVATAR_ITEMS_CATALOG } from '../catalog/avatar-items.catalog';
import { ITEMS_CATALOG } from '../catalog/items.catalog';
import { TEST_USERS_CATALOG } from '../catalog/test-users.catalog';
import { applySignupDefaults } from './signup-defaults.service';

/**
 * Inserts any catalog entries that don't yet exist in the DB.
 * Existing documents are never modified — they are the stable source for
 * ObjectId references stored in user inventory.
 *
 * To apply catalog changes to existing records in development:
 *   drop the relevant collection and restart the server.
 */
export async function syncCatalog(): Promise<void> {
    await Promise.all([
        syncAnimations(),
        syncAvatarItems(),
        syncItems(),
    ]);
    // Test users run after items are seeded — applySignupDefaults depends on them
    await syncTestUsers();
}

async function syncAnimations(): Promise<void> {
    if (ANIMATIONS_CATALOG.length === 0) return;

    let inserted = 0;
    for (const entry of ANIMATIONS_CATALOG) {
        const result = await AnimationModel.findOneAndUpdate(
            { name: entry.name },
            { $setOnInsert: entry },
            { upsert: true, new: false },
        );
        if (result === null) inserted++;
    }

    console.log(`[catalog-sync] animations: ${inserted} inserted, ${ANIMATIONS_CATALOG.length - inserted} already exist`);
}

async function syncAvatarItems(): Promise<void> {
    if (AVATAR_ITEMS_CATALOG.length === 0) return;

    let inserted = 0;
    for (const entry of AVATAR_ITEMS_CATALOG) {
        const result = await AvatarItemModel.findOneAndUpdate(
            { name: entry.name },
            { $setOnInsert: entry },
            { upsert: true, new: false },
        );
        if (result === null) inserted++;
    }

    console.log(`[catalog-sync] avatar_items: ${inserted} inserted, ${AVATAR_ITEMS_CATALOG.length - inserted} already exist`);
}

async function syncItems(): Promise<void> {
    if (ITEMS_CATALOG.length === 0) return;

    let inserted = 0;
    for (const entry of ITEMS_CATALOG) {
        const result = await ItemModel.findOneAndUpdate(
            { name: entry.name },
            { $setOnInsert: entry },
            { upsert: true, new: false },
        );
        if (result === null) inserted++;
    }

    console.log(`[catalog-sync] items: ${inserted} inserted, ${ITEMS_CATALOG.length - inserted} already exist`);
}

async function syncTestUsers(): Promise<void> {
    if (TEST_USERS_CATALOG.length === 0) return;

    let inserted = 0;
    for (const entry of TEST_USERS_CATALOG) {
        const exists = await UserModel.findOne({ username: entry.username }).select('_id').lean();
        if (exists) continue;

        try {
            const { password, ...rest } = entry;
            const hashed = await bcrypt.hash(password, 10);
            const user = new UserModel({ ...rest, password: hashed });
            const saved = await user.save();
            await applySignupDefaults(saved._id as any, saved.username);
            inserted++;
        } catch (e) {
            console.error(`[catalog-sync] Failed to seed test user "${entry.username}":`, e);
        }
    }

    console.log(`[catalog-sync] test_users: ${inserted} inserted, ${TEST_USERS_CATALOG.length - inserted} already exist`);
}
