import mongoose, { Document, Schema } from 'mongoose';
import { Transaction, TransactionType } from '@chat-app/shared-types';

export interface ITransaction extends Omit<Transaction, '_id' | 'createdAt' | 'userId'>, Document {
    userId: mongoose.Types.ObjectId;
}

const amountSchema = new Schema(
    {
        coins: { type: Number, default: 0 },
        cash: { type: Number, default: 0 },
        realMoney: { type: Number, default: 0 },
    },
    { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: {
            type: String,
            enum: ['AVATAR_ITEM_PURCHASE', 'ROOM_ITEM_PURCHASE', 'ANIMATION_PURCHASE', 'ADD_MONEY'] satisfies TransactionType[],
            required: true,
        },
        direction: { type: String, enum: ['debit', 'credit'], required: true },
        description: { type: String, required: true },
        amount: { type: amountSchema, required: true },
        balanceBefore: { type: amountSchema, required: true },
        balanceAfter: { type: amountSchema, required: true },
        itemId: { type: String },
        itemName: { type: String },
        variantId: { type: String },
        variantName: { type: String },
    },
    {
        collection: 'transactions',
        timestamps: true,
    }
);

const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default TransactionModel;
