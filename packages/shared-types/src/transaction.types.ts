import { Amount } from './currency.types';

export type TransactionType = 'AVATAR_ITEM_PURCHASE' | 'ROOM_ITEM_PURCHASE' | 'ANIMATION_PURCHASE' | 'ADD_MONEY';

export interface Transaction {
    _id: string;
    userId: string;
    type: TransactionType;
    direction: 'debit' | 'credit';
    description: string;
    /** The charged or credited amount — always positive values */
    amount: Amount;
    /** Wallet snapshot immediately before this transaction */
    balanceBefore: Amount;
    /** Wallet snapshot immediately after this transaction */
    balanceAfter: Amount;
    /** ID of the purchased/sold item, if applicable */
    itemId?: string;
    /** Denormalised item name for display */
    itemName?: string;
    /** Avatar item variant ID, if applicable */
    variantId?: string;
    /** Denormalised variant name for display */
    variantName?: string;
    createdAt: string; // ISO date string
}

export interface PaginatedTransactions {
    transactions: Transaction[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
