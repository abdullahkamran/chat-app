import { AvatarItem, AvatarItemVariant } from '@chat-app/shared-types';

/** `wearable` names the packed rig art (an id in wearables.generated.json); catalog sync attaches it as rigAsset. */
type CatalogAvatarItemVariant = Omit<AvatarItemVariant, '_id' | 'rigAsset'> & { wearable?: string };

type CatalogAvatarItem = Omit<AvatarItem, '_id' | 'variants'> & {
    variants: CatalogAvatarItemVariant[];
};

/**
 * Source of truth for all avatar items.
 * On startup, new entries here are inserted into the DB automatically.
 * Existing DB entries are never overwritten — to update a record in dev,
 * drop the `avatar_items` collection and restart.
 */
export const AVATAR_ITEMS_CATALOG: CatalogAvatarItem[] = [
    // ── Skin ──────────────────────────────────────────────────────────────────
    {
        name: 'Default Skin',
        description: 'Default skin tone',
        subCategory: '',
        category: 'skin',
        isOverlappable: false,
        variants: [
            { name: 'Default', color: '#FFDBB8', wearable: 'body', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Face ──────────────────────────────────────────────────────────────────
    {
        name: 'Normal Face',
        description: 'Standard face shape',
        subCategory: '',
        category: 'face',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/face/normal-face.svg', wearable: 'face-normal', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Round Face',
        description: 'Softer round face shape',
        subCategory: '',
        category: 'face',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/face/round-face.svg', wearable: 'face-round', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Eye ───────────────────────────────────────────────────────────────────
    {
        name: 'Test Eyes 1',
        description: 'Eye style 1',
        subCategory: '',
        category: 'eye',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/eye/test-eyes-1.svg', wearable: 'eyes-1', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Test Eyes 2',
        description: 'Eye style 2',
        subCategory: '',
        category: 'eye',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/eye/test-eyes-2.svg', wearable: 'eyes-2', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Nose ──────────────────────────────────────────────────────────────────
    {
        name: 'Normal Nose',
        description: 'Standard nose shape',
        subCategory: '',
        category: 'nose',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/nose/nose-normal.svg', wearable: 'nose-normal', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Round Nose',
        description: 'Rounded nose shape',
        subCategory: '',
        category: 'nose',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/nose/nose-round.svg', wearable: 'nose-round', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Mouth ─────────────────────────────────────────────────────────────────
    {
        name: 'Happy Mouth',
        description: 'Cheerful smile',
        subCategory: '',
        category: 'mouth',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/mouth/mouth-happy.svg', wearable: 'mouth-happy', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Angry Mouth',
        description: 'Stern expression',
        subCategory: '',
        category: 'mouth',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/mouth/mouth-angry.svg', wearable: 'mouth-angry', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Hair ──────────────────────────────────────────────────────────────────
    {
        name: 'Center Parted',
        description: 'Center-parted hair',
        subCategory: 'female',
        category: 'hair',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/hair/female-center-parted.svg', wearable: 'hair-center-parted', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Puffed',
        description: 'Voluminous puffed hair',
        subCategory: 'male',
        category: 'hair',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/hair/male-puffed.svg', wearable: 'hair-puffed', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Spiked',
        description: 'Sharp spiked hair',
        subCategory: 'male',
        category: 'hair',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/hair/male-spiked.svg', wearable: 'hair-spiked', price: { coins: 50, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Tops ──────────────────────────────────────────────────────────────────
    {
        name: 'T-Shirt',
        description: 'Everyday t-shirt',
        subCategory: 'casual',
        category: 'tops',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/tops/t-shirt.svg', wearable: 't-shirt', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Denim Jacket',
        description: 'Classic denim jacket',
        subCategory: 'casual',
        category: 'tops',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/tops/denim-jacket.svg', wearable: 'denim-jacket', price: { coins: 75, cash: 0, realMoney: 0 } },
        ],
    },

    // ── Bottoms ───────────────────────────────────────────────────────────────
    {
        name: 'Jeans',
        description: 'Classic denim jeans',
        subCategory: 'casual',
        category: 'bottoms',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/bottoms/jeans.svg', wearable: 'jeans', price: { coins: 0, cash: 0, realMoney: 0 } },
        ],
    },
    {
        name: 'Cargo',
        description: 'Cargo pants with pockets',
        subCategory: 'casual',
        category: 'bottoms',
        isOverlappable: false,
        variants: [
            { name: 'Default', sourceUrl: 'avatar/bottoms/cargo.svg', wearable: 'cargo', price: { coins: 75, cash: 0, realMoney: 0 } },
        ],
    },
];
