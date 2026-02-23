import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Item from '../models/item.model';
import User from '../models/user.model';
import { requireAuth } from '../middleware/auth.middleware';

// ── Shop Router ───────────────────────────────────────────────────────────────
// Mounted at /api/v1/shop in index.ts
export const shopRouter = express.Router();

// GET /api/v1/shop/items?category=&page=&limit=
shopRouter.get('/items', async (req: Request, res: Response): Promise<void> => {
    const category = req.query.category as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    try {
        const filter = category ? { category } : {};
        const [items, total] = await Promise.all([
            Item.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
            Item.countDocuments(filter),
        ]);
        res.send({ items, page, limit, total, hasMore: skip + items.length < total });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// GET /api/v1/shop/categories
shopRouter.get('/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Item.distinct('category');
        res.send(categories);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// POST /api/v1/shop/buy  (auth required)
shopRouter.post('/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.body;
    const userId = req.user!.userId;

    if (!itemId) {
        res.status(400).send({ error: 'itemId is required' });
        return;
    }

    try {
        const item = await Item.findById(new mongoose.Types.ObjectId(itemId));
        if (!item) {
            res.status(404).send({ error: 'Item not found' });
            return;
        }

        const user = await User.findById(new mongoose.Types.ObjectId(userId));
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }

        const alreadyOwned = user.inventory.some((id) => id.toString() === itemId);
        if (alreadyOwned) {
            res.status(409).send({ error: 'Item already owned' });
            return;
        }

        // Check affordability for each non-zero price field
        if (item.price.coins > 0 && user.amount.coins < item.price.coins) {
            res.status(402).send({ error: 'Insufficient coins' });
            return;
        }
        if (item.price.cash > 0 && user.amount.cash < item.price.cash) {
            res.status(402).send({ error: 'Insufficient cash' });
            return;
        }
        if (item.price.realMoney > 0 && user.amount.realMoney < item.price.realMoney) {
            res.status(402).send({ error: 'Insufficient real money' });
            return;
        }

        // Build deduction map for non-zero price fields
        const inc: Record<string, number> = {};
        if (item.price.coins > 0) inc['amount.coins'] = -item.price.coins;
        if (item.price.cash > 0) inc['amount.cash'] = -item.price.cash;
        if (item.price.realMoney > 0) inc['amount.realMoney'] = -item.price.realMoney;

        const updated = await User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId),
            {
                $inc: inc,
                $addToSet: { inventory: new mongoose.Types.ObjectId(itemId) },
            },
            { new: true }
        );

        res.send(updated);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// ── Inventory Router ──────────────────────────────────────────────────────────
// Mounted at /api/v1/inventory in index.ts
export const inventoryRouter = express.Router();

// GET /api/v1/inventory  (auth required)
inventoryRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    try {
        const user = await User.findById(new mongoose.Types.ObjectId(userId)).populate('inventory');
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }
        res.send(user.inventory);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});
