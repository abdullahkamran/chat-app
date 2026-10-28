import { Facing, Item, ItemAction, ItemPlacement, ItemState, ItemVariant } from '@chat-app/shared-types';

type CatalogItem = Omit<Item, '_id' | 'variant'> & {
    variant: Omit<ItemVariant, '_id'>;
};

type CatalogItemInput = Pick<CatalogItem, 'name' | 'description' | 'category' | 'placement' | 'dimensions' | 'assetUrl'>
    & Partial<CatalogItem>
    & { coins: number };

/** Fills in what nearly every item shares: one Default variant, no action, no states, coins only. */
function item({ coins, ...rest }: CatalogItemInput): CatalogItem {
    return {
        price: { coins, cash: 0, realMoney: 0 },
        variant: { name: 'Default', description: '' },
        action: ItemAction.NONE,
        states: ItemState.NONE,
        isOverlappable: false,
        ...rest,
    };
}

/** A one-seat item. Seat heights are eyeballed from placeholder art; tune them on a device. */
function oneSeat(z: number): CatalogItem['seats'] {
    return [{ cell: { x: 0, y: 0 }, facing: Facing.SW, offset: { x: 0, y: 0, z } }];
}

/** Seats along the x axis of an n×1 item, spaced like Test Couch's. */
function rowSeats(n: number): CatalogItem['seats'] {
    return Array.from({ length: n }, (_, x) => ({
        cell: { x, y: 0 },
        facing: Facing.SW,
        offset: { x: -0.95 + 0.7 * x, y: -0.45, z: 0.1 },
    }));
}

const FLOOR = ItemPlacement.FLOOR;
const WALL = ItemPlacement.WALL;

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

    // Everything below uses generated placeholder art (`pnpm art:items`) until real art
    // replaces the files at the same paths.

    // ── Furniture: seats ──────────────────────────────────────────────────────
    item({ name: 'Stool', description: 'A simple perch', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 8, assetUrl: 'items/furniture/stool.png', action: ItemAction.SIT, seats: oneSeat(0.45), canOwnMultiple: true }),
    item({ name: 'Dining Chair', description: 'Pull up a chair', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 12, assetUrl: 'items/furniture/dining-chair.png', action: ItemAction.SIT, seats: oneSeat(0.4), canOwnMultiple: true }),
    item({ name: 'Armchair', description: 'Deep, soft and hard to leave', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 25, assetUrl: 'items/furniture/armchair.png', action: ItemAction.SIT, seats: oneSeat(0.35), canOwnMultiple: true }),
    item({ name: 'Bean Bag', description: 'Sink right in', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 20, assetUrl: 'items/furniture/bean-bag.png', action: ItemAction.SIT, seats: oneSeat(0.2), canOwnMultiple: true }),
    item({ name: 'Gaming Chair', description: 'RGB not included', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 40, assetUrl: 'items/furniture/gaming-chair.png', action: ItemAction.SIT, seats: oneSeat(0.45), canOwnMultiple: true }),
    item({ name: 'Throne', description: 'For whoever runs the room', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 150, assetUrl: 'items/furniture/throne.png', action: ItemAction.SIT, seats: oneSeat(0.5), canOwnMultiple: true }),
    item({ name: 'Bench', description: 'Seats two', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 1, z: 1 }, coins: 18, assetUrl: 'items/furniture/bench.png', action: ItemAction.SIT, seats: rowSeats(2), canOwnMultiple: true }),
    item({ name: 'Sofa', description: 'Room for the whole crew', category: 'Furniture', placement: FLOOR, dimensions: { x: 3, y: 1, z: 1 }, coins: 45, assetUrl: 'items/furniture/sofa.png', action: ItemAction.SIT, seats: rowSeats(3), canOwnMultiple: true }),

    // ── Furniture: tables, storage, bedroom, kitchen ──────────────────────────
    item({ name: 'Coffee Table', description: 'Coasters, please', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 1, z: 1 }, coins: 15, assetUrl: 'items/furniture/coffee-table.png', canOwnMultiple: true }),
    item({ name: 'Dining Table', description: 'Dinner for four', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 2, z: 1 }, coins: 30, assetUrl: 'items/furniture/dining-table.png', canOwnMultiple: true }),
    item({ name: 'Desk', description: 'Where the work happens, sometimes', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 1, z: 1 }, coins: 25, assetUrl: 'items/furniture/desk.png', canOwnMultiple: true }),
    item({ name: 'Bookshelf', description: 'Full of books you will read one day', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 25, assetUrl: 'items/furniture/bookshelf.png', canOwnMultiple: true }),
    item({ name: 'Wardrobe', description: 'Not a portal. Probably.', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 30, assetUrl: 'items/furniture/wardrobe.png', canOwnMultiple: true }),
    // LAY isn't wired up in the room engine yet; tapping walks the avatar next to the bed.
    item({ name: 'Bed', description: 'Five more minutes', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 2, z: 1 }, coins: 50, assetUrl: 'items/furniture/bed.png', action: ItemAction.LAY, canOwnMultiple: true }),
    item({ name: 'Kitchen Counter', description: 'Counter space at last', category: 'Furniture', placement: FLOOR, dimensions: { x: 2, y: 1, z: 1 }, coins: 35, assetUrl: 'items/furniture/kitchen-counter.png', canOwnMultiple: true }),
    item({ name: 'Fridge', description: 'Always something cold inside', category: 'Furniture', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 30, assetUrl: 'items/furniture/fridge.png', canOwnMultiple: true }),

    // ── Decor: floor ──────────────────────────────────────────────────────────
    item({ name: 'Rug', description: 'Ties the room together', category: 'Decor', placement: FLOOR, dimensions: { x: 2, y: 2, z: 0 }, coins: 15, assetUrl: 'items/decor/rug.png', isOverlappable: true, canOwnMultiple: true }),
    // DRINK_WATER isn't wired up in the room engine yet; tapping walks the avatar next to it.
    item({ name: 'Water Dispenser', description: 'Stay hydrated', category: 'Decor', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 15, assetUrl: 'items/decor/water-dispenser.png', action: ItemAction.DRINK_WATER, canOwnMultiple: true }),
    item({ name: 'Arcade Cabinet', description: 'Insert coin', category: 'Decor', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 60, assetUrl: 'items/decor/arcade-cabinet.png', canOwnMultiple: true }),
    item({ name: 'Speaker', description: 'Turn it up', category: 'Decor', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 20, assetUrl: 'items/decor/speaker.png', canOwnMultiple: true }),
    item({ name: 'Fish Tank', description: 'Low-maintenance pets', category: 'Decor', placement: FLOOR, dimensions: { x: 2, y: 1, z: 1 }, coins: 40, assetUrl: 'items/decor/fish-tank.png', canOwnMultiple: true }),
    item({ name: 'Trash Can', description: 'Somebody has to', category: 'Decor', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 5, assetUrl: 'items/decor/trash-can.png', canOwnMultiple: true }),

    // ── Decor: wall ───────────────────────────────────────────────────────────
    item({ name: 'Poster', description: 'Your favourite band, probably', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 5, assetUrl: 'items/wall-items/poster.png', canOwnMultiple: true }),
    item({ name: 'Framed Painting', description: 'Very fancy', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 12, assetUrl: 'items/wall-items/framed-painting.png', canOwnMultiple: true }),
    item({ name: 'Wall Clock', description: 'Tick tock', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wall-items/wall-clock.png', canOwnMultiple: true }),
    item({ name: 'Window', description: 'A view of somewhere nicer', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 20, assetUrl: 'items/wall-items/window.png', canOwnMultiple: true }),
    item({ name: 'Wall Shelf', description: 'For trophies and trinkets', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 12, assetUrl: 'items/wall-items/wall-shelf.png', canOwnMultiple: true }),
    item({ name: 'Mirror', description: 'Looking good', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/wall-items/mirror.png', canOwnMultiple: true }),
    item({ name: 'Dartboard', description: 'Mind the wallpaper', category: 'Decor', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wall-items/dartboard.png', canOwnMultiple: true }),
    item({ name: 'Neon Sign', description: 'Glows in the dark', category: 'Decor', placement: WALL, dimensions: { x: 2, y: 0, z: 1 }, coins: 35, assetUrl: 'items/wall-items/neon-sign.png', canOwnMultiple: true }),

    // ── Lighting ──────────────────────────────────────────────────────────────
    item({ name: 'Floor Lamp', description: 'Warm light for cosy nights', category: 'Lighting', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 12, assetUrl: 'items/lighting/floor-lamp.png', canOwnMultiple: true }),
    item({ name: 'Lava Lamp', description: 'Groovy', category: 'Lighting', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 18, assetUrl: 'items/lighting/lava-lamp.png', canOwnMultiple: true }),

    // ── Plants ────────────────────────────────────────────────────────────────
    item({ name: 'Potted Plant', description: 'A little green', category: 'Plants', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 8, assetUrl: 'items/plants/potted-plant.png', canOwnMultiple: true }),
    item({ name: 'Cactus', description: 'No watering, no hugging', category: 'Plants', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 6, assetUrl: 'items/plants/cactus.png', canOwnMultiple: true }),
    item({ name: 'Monstera', description: 'Big leaves, big energy', category: 'Plants', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 14, assetUrl: 'items/plants/monstera.png', canOwnMultiple: true }),

    // ── Seasonal ──────────────────────────────────────────────────────────────
    item({ name: 'Pumpkin Lantern', description: 'Spooky season', category: 'Seasonal', placement: FLOOR, dimensions: { x: 1, y: 1, z: 1 }, coins: 20, assetUrl: 'items/seasonal/pumpkin-lantern.png', canOwnMultiple: true }),
    item({ name: 'Snowman', description: 'Will not melt indoors', category: 'Seasonal', placement: FLOOR, dimensions: { x: 1, y: 1, z: 2 }, coins: 25, assetUrl: 'items/seasonal/snowman.png', canOwnMultiple: true }),

    // ── Floorings ─────────────────────────────────────────────────────────────
    item({ name: 'Wood Planks Floor', description: 'Classic hardwood', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/floorings/wood-planks.png', isOverlappable: true }),
    item({ name: 'Checkerboard Floor', description: 'Diner vibes', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/floorings/checkerboard.png', isOverlappable: true }),
    item({ name: 'Carpet Floor', description: 'Soft underfoot', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/floorings/carpet.png', isOverlappable: true }),
    item({ name: 'Tile Floor', description: 'Easy to clean', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/floorings/tiles.png', isOverlappable: true }),
    item({ name: 'Concrete Floor', description: 'Industrial chic', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/floorings/concrete.png', isOverlappable: true }),
    item({ name: 'Grass Floor', description: 'Bring the outdoors in', category: 'Floorings', placement: FLOOR, dimensions: { x: 1, y: 0, z: 1 }, coins: 20, assetUrl: 'items/floorings/grass.png', isOverlappable: true }),

    // ── Wallpapers ────────────────────────────────────────────────────────────
    item({ name: 'Brick Wallpaper', description: 'Exposed brick', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/wallpapers/brick.png', isOverlappable: true }),
    item({ name: 'Striped Wallpaper', description: 'Bold stripes', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/wallpapers/striped.png', isOverlappable: true }),
    item({ name: 'Wood Panel Wallpaper', description: 'Cabin in the woods', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 15, assetUrl: 'items/wallpapers/wood-panel.png', isOverlappable: true }),
    item({ name: 'Cream Wallpaper', description: 'Plain and calm', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wallpapers/cream.png', isOverlappable: true }),
    item({ name: 'Sage Wallpaper', description: 'Soft green', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wallpapers/sage.png', isOverlappable: true }),
    item({ name: 'Blush Wallpaper', description: 'Soft pink', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wallpapers/blush.png', isOverlappable: true }),
    item({ name: 'Charcoal Wallpaper', description: 'Dark and moody', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 10, assetUrl: 'items/wallpapers/charcoal.png', isOverlappable: true }),
    item({ name: 'Starry Night Wallpaper', description: 'Sleep under the stars', category: 'Wallpapers', placement: WALL, dimensions: { x: 1, y: 0, z: 1 }, coins: 20, assetUrl: 'items/wallpapers/starry-night.png', isOverlappable: true }),
];
