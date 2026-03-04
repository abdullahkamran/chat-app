import { Amount } from './currency.types';

export interface Animation {
    _id: string;
    name: string; // camelCase string unique identifier
    category: AnimationCategory;
    price: Amount;
}

export const AnimationCategory = {
    EMOTE: 'EMOTE',
    WALK: 'WALK',
    SIT: 'SIT',
} as const;

export type AnimationCategory = (typeof AnimationCategory)[keyof typeof AnimationCategory];

export interface PaginatedAnimations {
    animations: Animation[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
