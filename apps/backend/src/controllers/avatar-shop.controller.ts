import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import AvatarItem from '../models/avatar-item.model';
import User from '../models/user.model';
import { requireAuth } from '../middleware/auth.middleware';
import { logTransaction } from './transaction.controller';

// ── Avatar Shop Router ────────────────────────────────────────────────────────
// Mounted at /api/v1/shop in index.ts (alongside shopRouter)
export const avatarShopRouter = express.Router();

// GET /api/v1/shop/avatar-items?category=&page=&limit=
avatarShopRouter.get('/avatar-items', async (req: Request, res: Response): Promise<void> => {
    const category = req.query.category as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    try {
        const filter = category ? { category } : {};
        const [items, total] = await Promise.all([
            AvatarItem.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
            AvatarItem.countDocuments(filter),
        ]);
        res.send({ items, page, limit, total, hasMore: skip + items.length < total });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// GET /api/v1/shop/avatar-items/categories
avatarShopRouter.get('/avatar-items/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await AvatarItem.distinct('category');
        res.send(categories);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// POST /api/v1/shop/avatar-items/buy  (auth required)
avatarShopRouter.post('/avatar-items/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { itemId, variantId } = req.body;
    const userId = req.user!.userId;

    if (!itemId || !variantId) {
        res.status(400).send({ error: 'itemId and variantId are required' });
        return;
    }

    try {
        const avatarItem = await AvatarItem.findById(new mongoose.Types.ObjectId(itemId));
        if (!avatarItem) {
            res.status(404).send({ error: 'Avatar item not found' });
            return;
        }

        const variant = avatarItem.variants.find((v) => v._id.toString() === variantId);
        if (!variant) {
            res.status(404).send({ error: 'Variant not found' });
            return;
        }

        const user = await User.findById(new mongoose.Types.ObjectId(userId));
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }

        const alreadyOwned = user.avatarInventory.some(
            (entry) => entry.item.toString() === itemId && entry.variantId === variantId
        );
        if (alreadyOwned) {
            res.status(409).send({ error: 'Variant already owned' });
            return;
        }

        // Check affordability for each non-zero price field
        if (variant.price.coins > 0 && user.amount.coins < variant.price.coins) {
            res.status(402).send({ error: 'Insufficient coins' });
            return;
        }
        if (variant.price.cash > 0 && user.amount.cash < variant.price.cash) {
            res.status(402).send({ error: 'Insufficient cash' });
            return;
        }
        if (variant.price.realMoney > 0 && user.amount.realMoney < variant.price.realMoney) {
            res.status(402).send({ error: 'Insufficient real money' });
            return;
        }

        // Build deduction map for non-zero price fields
        const inc: Record<string, number> = {};
        if (variant.price.coins > 0) inc['amount.coins'] = -variant.price.coins;
        if (variant.price.cash > 0) inc['amount.cash'] = -variant.price.cash;
        if (variant.price.realMoney > 0) inc['amount.realMoney'] = -variant.price.realMoney;

        const balanceBefore = { ...user.amount };

        const updated = await User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId),
            {
                $inc: inc,
                $push: {
                    avatarInventory: {
                        item: new mongoose.Types.ObjectId(itemId),
                        variantId,
                    },
                },
            },
            { new: true }
        );

        await logTransaction({
            userId,
            type: 'AVATAR_ITEM_PURCHASE',
            direction: 'debit',
            description: `Purchased ${avatarItem.name} – ${variant.name}`,
            amount: variant.price,
            balanceBefore,
            balanceAfter: updated!.amount,
            itemId,
            itemName: avatarItem.name,
            variantId,
            variantName: variant.name,
        });

        res.send(updated);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// ── Avatar Inventory Router ────────────────────────────────────────────────────
// Mounted at /api/v1/inventory in index.ts (alongside inventoryRouter)
export const avatarInventoryRouter = express.Router();

// GET /api/v1/inventory/avatar  (auth required)
avatarInventoryRouter.get('/avatar', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    try {
        const user = await User.findById(new mongoose.Types.ObjectId(userId)).populate('avatarInventory.item');
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }
        res.send(user.avatarInventory);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});
