import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Amount, TransactionType } from '@chat-app/shared-types';
import TransactionModel from '../models/transaction.model';
import { requireAuth } from '../middleware/auth.middleware';

// ── Transaction Router ────────────────────────────────────────────────────────
// Mounted at /api/v1/transaction-history in index.ts
export const transactionRouter = express.Router();

// GET /api/v1/transaction-history  (auth required)
transactionRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    try {
        const filter = { userId: new mongoose.Types.ObjectId(userId) };
        const [transactions, total] = await Promise.all([
            TransactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            TransactionModel.countDocuments(filter),
        ]);

        res.send({
            transactions,
            page,
            limit,
            total,
            hasMore: skip + transactions.length < total,
        });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// ── Helper ────────────────────────────────────────────────────────────────────

interface LogTransactionParams {
    userId: string;
    type: TransactionType;
    direction: 'debit' | 'credit';
    description: string;
    amount: Amount;
    balanceBefore: Amount;
    balanceAfter: Amount;
    itemId?: string;
    itemName?: string;
    variantId?: string;
    variantName?: string;
}

/** Insert a transaction audit record. Errors are logged but not re-thrown so they never block the purchase response. */
export async function logTransaction(params: LogTransactionParams): Promise<void> {
    try {
        await TransactionModel.create({
            userId: new mongoose.Types.ObjectId(params.userId),
            type: params.type,
            direction: params.direction,
            description: params.description,
            amount: params.amount,
            balanceBefore: params.balanceBefore,
            balanceAfter: params.balanceAfter,
            itemId: params.itemId,
            itemName: params.itemName,
            variantId: params.variantId,
            variantName: params.variantName,
        });
    } catch (e) {
        console.error('[logTransaction] Failed to write transaction log:', e);
    }
}
