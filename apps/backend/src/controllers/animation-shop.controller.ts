import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Animation from '../models/animation.model';
import User from '../models/user.model';
import { requireAuth } from '../middleware/auth.middleware';
import { logTransaction } from './transaction.controller';

// ── Animation Shop Router ──────────────────────────────────────────────────────
// Mounted at /api/v1/shop in index.ts
export const animationShopRouter = express.Router();

// GET /api/v1/shop/animations?category=&page=&limit=
animationShopRouter.get('/animations', async (req: Request, res: Response): Promise<void> => {
    const category = req.query.category as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    try {
        const filter = category ? { category } : {};
        const [animations, total] = await Promise.all([
            Animation.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
            Animation.countDocuments(filter),
        ]);
        res.send({ animations, page, limit, total, hasMore: skip + animations.length < total });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// GET /api/v1/shop/animations/categories
animationShopRouter.get('/animations/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Animation.distinct('category');
        res.send(categories);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// POST /api/v1/shop/animations/buy  (auth required)
animationShopRouter.post('/animations/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { animationId } = req.body;
    const userId = req.user!.userId;

    if (!animationId) {
        res.status(400).send({ error: 'animationId is required' });
        return;
    }

    try {
        const animation = await Animation.findById(new mongoose.Types.ObjectId(animationId));
        if (!animation) {
            res.status(404).send({ error: 'Animation not found' });
            return;
        }

        const user = await User.findById(new mongoose.Types.ObjectId(userId));
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }

        const alreadyOwned = user.animations.some((id) => id.toString() === animationId);
        if (alreadyOwned) {
            res.status(409).send({ error: 'Animation already owned' });
            return;
        }

        if (animation.price.coins > 0 && user.amount.coins < animation.price.coins) {
            res.status(402).send({ error: 'Insufficient coins' });
            return;
        }
        if (animation.price.cash > 0 && user.amount.cash < animation.price.cash) {
            res.status(402).send({ error: 'Insufficient cash' });
            return;
        }
        if (animation.price.realMoney > 0 && user.amount.realMoney < animation.price.realMoney) {
            res.status(402).send({ error: 'Insufficient real money' });
            return;
        }

        const inc: Record<string, number> = {};
        if (animation.price.coins > 0) inc['amount.coins'] = -animation.price.coins;
        if (animation.price.cash > 0) inc['amount.cash'] = -animation.price.cash;
        if (animation.price.realMoney > 0) inc['amount.realMoney'] = -animation.price.realMoney;

        const balanceBefore = { ...user.amount };

        const updated = await User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId),
            {
                $inc: inc,
                $push: { animations: new mongoose.Types.ObjectId(animationId) },
            },
            { new: true }
        );

        await logTransaction({
            userId,
            type: 'ANIMATION_PURCHASE',
            direction: 'debit',
            description: `Purchased animation: ${animation.name}`,
            amount: animation.price,
            balanceBefore,
            balanceAfter: updated!.amount,
            itemId: animationId,
            itemName: animation.name,
        });

        res.send(updated);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// ── Animation Inventory Router ─────────────────────────────────────────────────
// Mounted at /api/v1/inventory in index.ts
export const animationInventoryRouter = express.Router();

// GET /api/v1/inventory/animations  (auth required)
animationInventoryRouter.get('/animations', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    try {
        const user = await User.findById(new mongoose.Types.ObjectId(userId)).populate('animations');
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }
        res.send(user.animations);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});
