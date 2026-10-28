import { ImageSource } from 'expo-image';

// ── Static asset map ───────────────────────────────────────────────────────────
// Keys match the `sourceUrl` values stored in the DB catalog.
// require() calls must be static — Metro resolves them at bundle time.
const AVATAR_ASSET_MAP: Record<string, ImageSource> = {
    // ── Face ──────────────────────────────────────────────────────────────────
    'avatar/face/normal-face.svg': require('../assets/avatars/face/normal-face.svg'),
    'avatar/face/round-face.svg':  require('../assets/avatars/face/round-face.svg'),

    // ── Eye ───────────────────────────────────────────────────────────────────
    'avatar/eye/test-eyes-1.svg': require('../assets/avatars/eye/test-eyes-1.svg'),
    'avatar/eye/test-eyes-2.svg': require('../assets/avatars/eye/test-eyes-2.svg'),

    // ── Nose ──────────────────────────────────────────────────────────────────
    'avatar/nose/nose-normal.svg': require('../assets/avatars/nose/nose-normal.svg'),
    'avatar/nose/nose-round.svg':  require('../assets/avatars/nose/nose-round.svg'),

    // ── Mouth ─────────────────────────────────────────────────────────────────
    'avatar/mouth/mouth-happy.svg': require('../assets/avatars/mouth/mouth-happy.svg'),
    'avatar/mouth/mouth-angry.svg': require('../assets/avatars/mouth/mouth-angry.svg'),

    // ── Hair ──────────────────────────────────────────────────────────────────
    'avatar/hair/female-center-parted.svg': require('../assets/avatars/hair/female-center-parted.svg'),
    'avatar/hair/male-puffed.svg':          require('../assets/avatars/hair/male-puffed.svg'),
    'avatar/hair/male-spiked.svg':          require('../assets/avatars/hair/male-spiked.svg'),

    // ── Tops ──────────────────────────────────────────────────────────────────
    'avatar/tops/t-shirt.svg':      require('../assets/avatars/tops/t-shirt.svg'),
    'avatar/tops/denim-jacket.svg': require('../assets/avatars/tops/denim-jacket.svg'),

    // ── Bottoms ───────────────────────────────────────────────────────────────
    'avatar/bottoms/jeans.svg': require('../assets/avatars/bottoms/jeans.svg'),
    'avatar/bottoms/cargo.svg': require('../assets/avatars/bottoms/cargo.svg'),
};

// ── Item (room/shop) asset map ────────────────────────────────────────────────
// Keys match the `assetUrl` values stored in the DB catalog (items.catalog.ts).
// NOTE: The catalog entry for Test Floor incorrectly uses 'items/floorings/test-tv.png'
//       but the actual file is test-floor.png — both keys are registered below.
const ITEM_ASSET_MAP: Record<string, ImageSource> = {
    // ── Furniture ─────────────────────────────────────────────────────────────
    'items/furniture/test-chair.png': require('../assets/items/furniture/test-chair.png'),
    'items/furniture/test-couch.png': require('../assets/items/furniture/test-couch.png'),

    // ── Wall items ────────────────────────────────────────────────────────────
    'items/wall-items/test-tv.png': require('../assets/items/wall-items/test-tv.png'),

    // ── Floorings ─────────────────────────────────────────────────────────────
    'items/floorings/test-floor.png': require('../assets/items/floorings/test-floor.png'),
    'items/floorings/test-tv.png':    require('../assets/items/floorings/test-floor.png'), // catalog typo alias

    // ── Wallpapers ────────────────────────────────────────────────────────────
    'items/wallpapers/test-wallpaper.png': require('../assets/items/wallpapers/test-wallpaper.png'),

    // Placeholder images from `pnpm art:items` (apps/backend); real art replaces the files in place.
    // ── furniture (placeholder art)
    'items/furniture/stool.png':           require('../assets/items/furniture/stool.png'),
    'items/furniture/dining-chair.png':    require('../assets/items/furniture/dining-chair.png'),
    'items/furniture/armchair.png':        require('../assets/items/furniture/armchair.png'),
    'items/furniture/bean-bag.png':        require('../assets/items/furniture/bean-bag.png'),
    'items/furniture/gaming-chair.png':    require('../assets/items/furniture/gaming-chair.png'),
    'items/furniture/throne.png':          require('../assets/items/furniture/throne.png'),
    'items/furniture/bench.png':           require('../assets/items/furniture/bench.png'),
    'items/furniture/sofa.png':            require('../assets/items/furniture/sofa.png'),
    'items/furniture/coffee-table.png':    require('../assets/items/furniture/coffee-table.png'),
    'items/furniture/dining-table.png':    require('../assets/items/furniture/dining-table.png'),
    'items/furniture/desk.png':            require('../assets/items/furniture/desk.png'),
    'items/furniture/bookshelf.png':       require('../assets/items/furniture/bookshelf.png'),
    'items/furniture/wardrobe.png':        require('../assets/items/furniture/wardrobe.png'),
    'items/furniture/bed.png':             require('../assets/items/furniture/bed.png'),
    'items/furniture/kitchen-counter.png': require('../assets/items/furniture/kitchen-counter.png'),
    'items/furniture/fridge.png':          require('../assets/items/furniture/fridge.png'),

    // ── decor (placeholder art)
    'items/decor/rug.png':             require('../assets/items/decor/rug.png'),
    'items/decor/water-dispenser.png': require('../assets/items/decor/water-dispenser.png'),
    'items/decor/arcade-cabinet.png':  require('../assets/items/decor/arcade-cabinet.png'),
    'items/decor/speaker.png':         require('../assets/items/decor/speaker.png'),
    'items/decor/fish-tank.png':       require('../assets/items/decor/fish-tank.png'),
    'items/decor/trash-can.png':       require('../assets/items/decor/trash-can.png'),

    // ── wall-items (placeholder art)
    'items/wall-items/poster.png':          require('../assets/items/wall-items/poster.png'),
    'items/wall-items/framed-painting.png': require('../assets/items/wall-items/framed-painting.png'),
    'items/wall-items/wall-clock.png':      require('../assets/items/wall-items/wall-clock.png'),
    'items/wall-items/window.png':          require('../assets/items/wall-items/window.png'),
    'items/wall-items/wall-shelf.png':      require('../assets/items/wall-items/wall-shelf.png'),
    'items/wall-items/mirror.png':          require('../assets/items/wall-items/mirror.png'),
    'items/wall-items/dartboard.png':       require('../assets/items/wall-items/dartboard.png'),
    'items/wall-items/neon-sign.png':       require('../assets/items/wall-items/neon-sign.png'),

    // ── lighting (placeholder art)
    'items/lighting/floor-lamp.png': require('../assets/items/lighting/floor-lamp.png'),
    'items/lighting/lava-lamp.png':  require('../assets/items/lighting/lava-lamp.png'),

    // ── plants (placeholder art)
    'items/plants/potted-plant.png': require('../assets/items/plants/potted-plant.png'),
    'items/plants/cactus.png':       require('../assets/items/plants/cactus.png'),
    'items/plants/monstera.png':     require('../assets/items/plants/monstera.png'),

    // ── seasonal (placeholder art)
    'items/seasonal/pumpkin-lantern.png': require('../assets/items/seasonal/pumpkin-lantern.png'),
    'items/seasonal/snowman.png':         require('../assets/items/seasonal/snowman.png'),

    // ── floorings (placeholder art)
    'items/floorings/wood-planks.png':  require('../assets/items/floorings/wood-planks.png'),
    'items/floorings/checkerboard.png': require('../assets/items/floorings/checkerboard.png'),
    'items/floorings/carpet.png':       require('../assets/items/floorings/carpet.png'),
    'items/floorings/tiles.png':        require('../assets/items/floorings/tiles.png'),
    'items/floorings/concrete.png':     require('../assets/items/floorings/concrete.png'),
    'items/floorings/grass.png':        require('../assets/items/floorings/grass.png'),

    // ── wallpapers (placeholder art)
    'items/wallpapers/brick.png':        require('../assets/items/wallpapers/brick.png'),
    'items/wallpapers/striped.png':      require('../assets/items/wallpapers/striped.png'),
    'items/wallpapers/wood-panel.png':   require('../assets/items/wallpapers/wood-panel.png'),
    'items/wallpapers/cream.png':        require('../assets/items/wallpapers/cream.png'),
    'items/wallpapers/sage.png':         require('../assets/items/wallpapers/sage.png'),
    'items/wallpapers/blush.png':        require('../assets/items/wallpapers/blush.png'),
    'items/wallpapers/charcoal.png':     require('../assets/items/wallpapers/charcoal.png'),
    'items/wallpapers/starry-night.png': require('../assets/items/wallpapers/starry-night.png'),
};

// ── Resolvers ─────────────────────────────────────────────────────────────────
/**
 * Resolves a `sourceUrl` key to an image source for use with expo-image.
 *
 * Currently: looks up the locally bundled asset via the static map above.
 *
 * ─── To switch to CDN in the future, replace the return with: ───
 *   return { uri: sourceUrl };                          // if DB stores full CDN URLs
 *   return { uri: `${CDN_BASE}/${sourceUrl}` };        // if DB stores relative keys
 */
export function resolveAvatarSource(sourceUrl?: string): ImageSource | null {
    if (!sourceUrl) return null;
    return AVATAR_ASSET_MAP[sourceUrl] ?? null;
}

/**
 * Resolves an `assetUrl` key (from the items catalog) to an image source
 * for use with expo-image.
 */
export function resolveItemSource(assetUrl: string): ImageSource | null {
    if (!assetUrl) return null;
    return ITEM_ASSET_MAP[assetUrl] ?? null;
}
