import { Facing, Item, ItemAction, ItemPlacement, ItemState, ItemVariant } from '@chat-app/shared-types';

type CatalogItem = Omit<Item, '_id' | 'variant'> & {
    variant: Omit<ItemVariant, '_id'>;
};

/**
 * Source of truth for all room/shop items.
 * On startup, new entries here are inserted into the DB automatically.
 * Existing DB entries are never overwritten — to update a record in dev,
 * drop the `items` collection and restart. The exception is layout data
 * (`seats`, `frontAssetUrl`), which is rewritten on every startup.
 */
export const ITEMS_CATALOG: CatalogItem[] = [
    {
        name: 'Test Chair',
        description: "I'm just a chair",
        category: 'Furniture',
        placement: ItemPlacement.FLOOR,
        dimensions: { x: 1, y: 1, z: 1 },
        price: { coins: 10, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.SIT,
        states: ItemState.NONE,
        isOverlappable: false,
        assetUrl: 'items/furniture/test-chair.png',
        // Seat offsets are eyeballed from the art; tune them on a device.
        seats: [{ cell: { x: 0, y: 0 }, facing: Facing.SW, offset: { x: 0, y: 0, z: 0.4 } }],
        canOwnMultiple: true,
    },
    {
        name: 'Test Couch',
        description: "I'm just a couch",
        category: 'Furniture',
        placement: ItemPlacement.FLOOR,
        dimensions: { x: 2, y: 1, z: 1 },
        price: { coins: 20, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.SIT,
        states: ItemState.NONE,
        isOverlappable: false,
        assetUrl: 'items/furniture/test-couch.png',
        seats: [
            { cell: { x: 0, y: 0 }, facing: Facing.SW, offset: { x: -0.95, y: -0.45, z: 0.1 } },
            { cell: { x: 1, y: 0 }, facing: Facing.SW, offset: { x: -0.25, y: -0.45, z: 0.1 } },
        ],
        canOwnMultiple: true,
    },
    {
        name: 'Test TV',
        description: "I'm just a TV",
        category: 'Decor',
        placement: ItemPlacement.WALL,
        dimensions: { x: 1, y: 0, z: 1 },
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
        dimensions: { x: 1, y: 0, z: 1 },
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
        dimensions: { x: 1, y: 0, z: 1 },
        price: { coins: 15, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: true,
        assetUrl: 'items/wallpapers/test-wallpaper.png',
    },
];
