import { Dimensions } from "./dimensions.types";
import { Amount } from "./currency.types";

export interface Item {
    _id: string;
    name: string;
    description: string;
    category: string;
    placement: ItemPlacement;
    dimensions: Dimensions;
    price: Amount;
    variant: ItemVariant;
    action: ItemAction;
    states: ItemState;
    isOverlappable: boolean;
    assetUrl: string;
}

export interface PaginatedItems {
    items: Item[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface ItemVariant {
    _id: string;
    name: string;
    description: string;
}

export const ItemPlacement = {
    FLOOR: 'FLOOR',
    WALL: 'WALL',
} as const;

export type ItemPlacement = (typeof ItemPlacement)[keyof typeof ItemPlacement];

export const ItemAction = {
    SIT: 'SIT',
    STAND: 'STAND',
    LAY: 'LAY',
    DRINK_WATER: 'DRINK_WATER',
    NONE: 'NONE',
} as const;

export type ItemAction = (typeof ItemAction)[keyof typeof ItemAction];

export const ItemState = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    NONE: 'NONE',
} as const;

export type ItemState = (typeof ItemState)[keyof typeof ItemState];
