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
export function resolveAvatarSource(sourceUrl: string): ImageSource | null {
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
