import mongoose from 'mongoose';
import { SIGNUP_DEFAULTS } from '../config/signup-defaults.config';
import User from '../models/user.model';
import RoomModel from '../models/room.model';
import AnimationModel from '../models/animation.model';
import AvatarItemModel from '../models/avatar-item.model';
import ItemModel from '../models/item.model';
import { logTransaction } from '../controllers/transaction.controller';

/**
 * Grants all configured default resources to a newly created user.
 * Errors are caught and logged per step — a missing catalog item never
 * blocks signup from completing.
 */
export async function applySignupDefaults(userId: mongoose.Types.ObjectId, username: string): Promise<void> {
    const userIdStr = userId.toString();

    await grantWallet(userIdStr);
    await grantAnimations(userId);
    await grantAvatarItems(userId);
    await grantInventoryItems(userId);
    await createDefaultRoom(userId, username);
}

// ── Steps ──────────────────────────────────────────────────────────────────────

async function grantWallet(userIdStr: string): Promise<void> {
    const { coins, cash, realMoney } = SIGNUP_DEFAULTS.wallet;
    if (!coins && !cash && !realMoney) return;

    const walletBefore = { coins: 0, cash: 0, realMoney: 0 };
    const walletAfter = { coins, cash, realMoney };

    await User.findByIdAndUpdate(userIdStr, {
        $inc: {
            'amount.coins': coins,
            'amount.cash': cash,
            'amount.realMoney': realMoney,
        },
    });

    await logTransaction({
        userId: userIdStr,
        type: 'ADD_MONEY',
        direction: 'credit',
        description: 'Welcome bonus',
        amount: walletAfter,
        balanceBefore: walletBefore,
        balanceAfter: walletAfter,
    });
}

async function grantAnimations(userId: mongoose.Types.ObjectId): Promise<void> {
    const names = SIGNUP_DEFAULTS.animationNames;
    if (names.length === 0) return;

    try {
        const found = await AnimationModel.find({ name: { $in: names } }).select('_id name');

        if (found.length) {
            await User.findByIdAndUpdate(userId, {
                $addToSet: { animations: { $each: found.map(a => a._id) } },
            });
        }

        const foundNames = found.map(a => a.name);
        const missing = names.filter(n => !foundNames.includes(n));
        if (missing.length) {
            console.warn('[signup-defaults] Animations not found in DB:', missing);
        }
    } catch (e) {
        console.error('[signup-defaults] Failed to grant animations:', e);
    }
}

async function grantAvatarItems(userId: mongoose.Types.ObjectId): Promise<void> {
    const variants = SIGNUP_DEFAULTS.avatarItemVariants;
    if (variants.length === 0) return;

    try {
        const itemNames = variants.map(v => v.itemName);
        const found = await AvatarItemModel.find({ name: { $in: itemNames } }).select('_id name variants');

        const entries: Array<{ item: mongoose.Types.ObjectId; variantId: string }> = [];
        for (const cfg of variants) {
            const doc = found.find(a => a.name === cfg.itemName);
            if (!doc) {
                console.warn(`[signup-defaults] AvatarItem not found in DB: "${cfg.itemName}"`);
                continue;
            }
            const variant = doc.variants.find(v => v.name === cfg.variantName);
            if (!variant) {
                console.warn(`[signup-defaults] Variant "${cfg.variantName}" not found on item "${cfg.itemName}"`);
                continue;
            }
            entries.push({ item: doc._id as mongoose.Types.ObjectId, variantId: variant._id.toString() });
        }

        if (entries.length) {
            await User.findByIdAndUpdate(userId, {
                $push: { avatarInventory: { $each: entries } },
            });
        }
    } catch (e) {
        console.error('[signup-defaults] Failed to grant avatar items:', e);
    }
}

async function grantInventoryItems(userId: mongoose.Types.ObjectId): Promise<void> {
    const names = SIGNUP_DEFAULTS.inventoryItemNames;
    if (names.length === 0) return;

    try {
        const found = await ItemModel.find({ name: { $in: names } }).select('_id name');

        if (found.length) {
            await User.findByIdAndUpdate(userId, {
                $addToSet: { inventory: { $each: found.map(i => i._id) } },
            });
        }

        const foundNames = found.map(i => i.name);
        const missing = names.filter(n => !foundNames.includes(n));
        if (missing.length) {
            console.warn('[signup-defaults] Room items not found in DB:', missing);
        }
    } catch (e) {
        console.error('[signup-defaults] Failed to grant room items:', e);
    }
}

async function createDefaultRoom(userId: mongoose.Types.ObjectId, username: string): Promise<void> {
    try {
        const { description, category, personLimit, dimensions } = SIGNUP_DEFAULTS.defaultRoom;
        const name = `${username}'s Room`;

        const room = new RoomModel({ ownerId: userId, name, description, category, personLimit, dimensions });
        const saved = await room.save();

        await User.findByIdAndUpdate(userId, {
            $push: { ownedRooms: saved._id, rooms: saved._id },
        });
    } catch (e) {
        console.error('[signup-defaults] Failed to create default room:', e);
    }
}
