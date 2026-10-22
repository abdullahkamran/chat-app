import { Dimensions } from "./dimensions.types";
import { Amount } from "./currency.types";
import type { Facing } from "./room.types";

/**
 * Where an avatar sits on a seatable item, in grid units relative to the item's position.
 * `cell` is the footprint cell the seat belongs to; actors walk to the cell in front of it.
 * `offset` places the sitter's anchor on the cushion: x and y in grid cells from the
 * item's position, z the seat height in grid units (1 = TILE_H px).
 */
export interface ItemSeat {
    cell: { x: number; y: number };
    facing: Facing;
    offset: { x: number; y: number; z: number };
}

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
    /** Parts drawn over a seated avatar (armrests, a backrest seen from behind), same frame as `assetUrl`. */
    frontAssetUrl?: string;
    /** Seats for items whose action is SIT. */
    seats?: ItemSeat[];
    canOwnMultiple?: boolean;
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
