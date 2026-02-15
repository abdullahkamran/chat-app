import { Dimensions } from "./dimensions.types";

export interface Item {
    _id: string;
    name: string;
    description: string;
    category: string;
    placement: ItemPlacement;
    dimensions: Dimensions;
    price: number;
    variant: ItemVariant;
    action: ItemAction;
    states: typeof ItemState;
    isOverlappable: boolean;
    assetUrl: string;
}

export interface ItemVariant {
    _id: string;
    name: string;
    description: string;
}

export enum ItemPlacement {
    FLOOR,
    WALL,
}

export enum ItemAction {
    SIT,
    STAND,
    LAY,
    DRINK_WATER,
    NONE,
}

export enum ItemState {
    ACTIVE,
    INACTIVE,
    NONE,
}
