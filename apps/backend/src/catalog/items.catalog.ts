import { Item, ItemAction, ItemPlacement, ItemState, ItemVariant } from '@chat-app/shared-types';

type CatalogItem = Omit<Item, '_id' | 'variant'> & {
    variant: Omit<ItemVariant, '_id'>;
};

/**
 * Source of truth for all room/shop items.
 * On startup, new entries here are inserted into the DB automatically.
 * Existing DB entries are never overwritten — to update a record in dev,
 * drop the `items` collection and restart.
 */
export const ITEMS_CATALOG: CatalogItem[] = [
    {
        name: 'Test Chair',
        description: "I'm just a chair",
        category: 'Furniture',
        placement: ItemPlacement.FLOOR,
        dimensions: { length: 1, width: 1, height: 0 },
        price: { coins: 10, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.SIT,
        states: ItemState.NONE,
        isOverlappable: false,
        assetUrl: 'items/furniture/test-chair.png',
    },
    {
        name: 'Test Table',
        description: "I'm just a table",
        category: 'Furniture',
        placement: ItemPlacement.FLOOR,
        dimensions: { length: 2, width: 1, height: 1 },
        price: { coins: 20, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: true,
        assetUrl: 'items/furniture/test-table.png',
    },
    {
        name: 'Test TV',
        description: "I'm just a TV",
        category: 'Decor',
        placement: ItemPlacement.WALL,
        dimensions: { length: 1, width: 0, height: 1 },
        price: { coins: 15, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: false,
        assetUrl: 'items/wall-items/test-tv.png',
    },
    {
        name: 'Test Floor',
        description: "I'm just a Floor",
        category: 'Floorings',
        placement: ItemPlacement.FLOOR,
        dimensions: { length: 1, width: 0, height: 1 },
        price: { coins: 15, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: true,
        assetUrl: 'items/floorings/test-tv.png',
    },
    {
        name: 'Test Wallpaper',
        description: "I'm just a Wallpaper",
        category: 'Wallpapers',
        placement: ItemPlacement.WALL,
        dimensions: { length: 1, width: 0, height: 1 },
        price: { coins: 15, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: true,
        assetUrl: 'items/wallpapers/test-wallpaper.png',
    },
];
