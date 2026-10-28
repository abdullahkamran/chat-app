import { AvatarItem, AvatarItemVariant } from '@chat-app/shared-types';

/** `wearable` names the packed rig art (an id in wearables.generated.json); catalog sync attaches it as rigAsset. */
type CatalogAvatarItemVariant = Omit<AvatarItemVariant, '_id' | 'rigAsset'> & { wearable?: string };

type CatalogAvatarItem = Omit<AvatarItem, '_id' | 'variants'> & {
    variants: CatalogAvatarItemVariant[];
};

const coins = (n: number) => ({ coins: n, cash: 0, realMoney: 0 });

/**
 * One variant per colour, all sharing one tintable wearable: the variant's colour tints it.
 * `extra` adds to the price of the colours named in `premium`.
 */
function colorways(
    wearable: string,
    price: number,
    colors: Record<string, string>,
    premium: { names: string[]; extra: number } = { names: [], extra: 0 },
): CatalogAvatarItemVariant[] {
    return Object.entries(colors).map(([name, color]) => ({
        name,
        color,
        wearable,
        price: coins(price + (premium.names.includes(name) ? premium.extra : 0)),
    }));
}

/** Picks named colours from a palette, in the order given. */
function pick(palette: Record<string, string>, names: string[]): Record<string, string> {
    return Object.fromEntries(names.map(n => [n, palette[n]]));
}

// Colour data for tints, not app UI.
const SKIN_TONES: Record<string, string> = {
    Porcelain: '#FCE8DA',
    Sand: '#F1C9A0',
    Honey: '#D9A066',
    Caramel: '#B97A4B',
    Bronze: '#8D5A3B',
    Mocha: '#6B4430',
    Espresso: '#4A2F22',
};

const HAIR_COLORS: Record<string, string> = {
    Black: '#2b2a2e',
    Brown: '#5a3a28',
    Blonde: '#e2c07c',
    Auburn: '#8e403b',
    Grey: '#a3a3a3',
    Pink: '#f27db4',
    Blue: '#4f7fe0',
    Green: '#4fbf7a',
};
/** Dyed colours cost a little more than natural ones. */
const DYED = { names: ['Pink', 'Blue', 'Green'], extra: 15 };

const CLOTHING: Record<string, string> = {
    Black: '#333333',
    White: '#f2f2f2',
    Grey: '#9a9a9a',
    Red: '#d64545',
    Blue: '#3f6fd8',
    Navy: '#2c3e66',
    Green: '#4f9e4f',
    Yellow: '#f5d13d',
    Pink: '#f07cb0',
    Purple: '#8a5cd6',
    Khaki: '#b9a77c',
    Denim: '#4a6a9c',
    Brown: '#7a5236',
};

const METALS: Record<string, string> = {
    Gold: '#f2c230',
    Silver: '#c9ced6',
    Black: '#333333',
};

function hair(name: string, description: string, subCategory: string, wearable: string, price: number): CatalogAvatarItem {
    return {
        name, description, subCategory, category: 'hair', isOverlappable: false,
        variants: colorways(wearable, price, HAIR_COLORS, DYED),
    };
}

/** An item with a single, untinted variant (facial features). */
function single(category: string, name: string, description: string, wearable: string, price: number): CatalogAvatarItem {
    return {
        name, description, subCategory: '', category, isOverlappable: false,
        variants: [{ name: 'Default', wearable, price: coins(price) }],
    };
}

function colored(
    category: string, subCategory: string, name: string, description: string,
    wearable: string, price: number, colors: Record<string, string>,
): CatalogAvatarItem {
    return { name, description, subCategory, category, isOverlappable: false, variants: colorways(wearable, price, colors) };
}

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
            ...colorways('body', 0, SKIN_TONES),
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

    // Everything below uses generated placeholder rig art (scripts/starter-art.ts) and has no
    // 2D sourceUrl yet, so editor and shop thumbnails fall back to the variant's colour.

    // ── Face ──────────────────────────────────────────────────────────────────
    single('face', 'Oval Face', 'Gently oval', 'face-oval', 40),
    single('face', 'Long Face', 'Long and narrow', 'face-long', 40),
    single('face', 'Square Face', 'Strong jawline', 'face-square', 50),
    single('face', 'Heart Face', 'Wide brow, pointed chin', 'face-heart', 50),

    // ── Eye ───────────────────────────────────────────────────────────────────
    single('eye', 'Sleepy Eyes', 'Not a morning person', 'eyes-sleepy', 30),
    single('eye', 'Wide Eyes', 'Big and bright', 'eyes-wide', 30),
    single('eye', 'Winking Eyes', 'You know the one', 'eyes-wink', 40),
    single('eye', 'Lashes', 'Long lashes', 'eyes-lashes', 40),
    single('eye', 'Happy Eyes', 'Smiling with your eyes', 'eyes-happy', 40),
    single('eye', 'Cat Eyes', 'Sharp and feline', 'eyes-cat', 60),
    single('eye', 'Star Eyes', 'Starstruck', 'eyes-star', 75),
    single('eye', 'Heart Eyes', 'Totally smitten', 'eyes-heart', 75),

    // ── Nose ──────────────────────────────────────────────────────────────────
    single('nose', 'Button Nose', 'Small and cute', 'nose-button', 30),
    single('nose', 'Pointed Nose', 'Sharp profile', 'nose-pointed', 30),
    single('nose', 'Wide Nose', 'Broad and soft', 'nose-wide', 30),
    single('nose', 'Freckled Nose', 'With a dusting of freckles', 'nose-freckled', 40),

    // ── Mouth ─────────────────────────────────────────────────────────────────
    single('mouth', 'Neutral Mouth', 'Poker face', 'mouth-neutral', 20),
    single('mouth', 'Smirk', 'Up to something', 'mouth-smirk', 30),
    single('mouth', 'Sad Mouth', 'Bit of a downer', 'mouth-sad', 30),
    single('mouth', 'Surprised Mouth', 'Oh!', 'mouth-surprised', 30),
    single('mouth', 'Big Grin', 'All teeth', 'mouth-grin', 40),
    single('mouth', 'Tongue Out', 'Cheeky', 'mouth-tongue', 50),

    // ── Hair ──────────────────────────────────────────────────────────────────
    hair('Buzz Cut', 'Clipped short all over', 'short', 'hair-buzz', 30),
    hair('Fade', 'Short on top, faded sides', 'short', 'hair-fade', 50),
    hair('Side Part', 'Neat side parting', 'short', 'hair-side-part', 40),
    hair('Quiff', 'Swept up at the front', 'short', 'hair-quiff', 60),
    hair('Pixie', 'Short and choppy', 'short', 'hair-pixie', 50),
    hair('Mohawk', 'A strip of spikes', 'short', 'hair-mohawk', 90),
    hair('Bob', 'Chin-length bob', 'medium', 'hair-bob', 50),
    hair('Curly Top', 'Tight curls', 'medium', 'hair-curly', 60),
    hair('Afro', 'Big and round', 'medium', 'hair-afro', 60),
    hair('Long Straight', 'Long and sleek', 'long', 'hair-long', 50),
    hair('Long Waves', 'Long, loose waves', 'long', 'hair-waves', 70),
    hair('Braids', 'Two long braids', 'long', 'hair-braids', 80),
    hair('Ponytail', 'Pulled back and tied', 'updo', 'hair-ponytail', 60),
    hair('Man Bun', 'Tied up on top', 'updo', 'hair-man-bun', 60),
    hair('Space Buns', 'Two buns up top', 'updo', 'hair-space-buns', 70),

    // ── Facial hair ───────────────────────────────────────────────────────────
    colored('facialHair', '', 'Stubble', 'A few days without a razor', 'facial-hair-stubble', 20, HAIR_COLORS),
    colored('facialHair', '', 'Moustache', 'Classic moustache', 'facial-hair-moustache', 30, HAIR_COLORS),
    colored('facialHair', '', 'Goatee', 'Chin beard and moustache', 'facial-hair-goatee', 40, HAIR_COLORS),
    colored('facialHair', '', 'Full Beard', 'Full and well kept', 'facial-hair-full', 50, HAIR_COLORS),
    colored('facialHair', '', 'Mutton Chops', 'Big sideburns', 'facial-hair-chops', 50, HAIR_COLORS),
    colored('facialHair', '', 'Handlebar Moustache', 'Curled at the tips', 'facial-hair-handlebar', 60, HAIR_COLORS),

    // ── Headwear ──────────────────────────────────────────────────────────────
    colored('headwear', 'hats', 'Cap', 'Baseball cap', 'headwear-cap', 40, pick(CLOTHING, ['Black', 'White', 'Red', 'Blue', 'Yellow', 'Green'])),
    colored('headwear', 'hats', 'Backwards Cap', 'Cap, worn backwards', 'headwear-cap-back', 40, pick(CLOTHING, ['Black', 'White', 'Red', 'Blue', 'Yellow', 'Green'])),
    colored('headwear', 'hats', 'Beanie', 'Knitted, with a bobble', 'headwear-beanie', 45, pick(CLOTHING, ['Black', 'Grey', 'Red', 'Navy', 'Yellow', 'Pink'])),
    colored('headwear', 'hats', 'Bucket Hat', 'Festival ready', 'headwear-bucket', 50, pick(CLOTHING, ['Black', 'White', 'Khaki', 'Denim', 'Green'])),
    colored('headwear', 'hats', 'Beret', 'Très chic', 'headwear-beret', 60, pick(CLOTHING, ['Black', 'Red', 'Navy', 'Pink'])),
    colored('headwear', 'hats', 'Cowboy Hat', 'Yeehaw', 'headwear-cowboy', 90, pick(CLOTHING, ['Brown', 'Black', 'White', 'Khaki'])),
    colored('headwear', 'audio', 'Headphones', 'Over-ear headphones', 'headwear-headphones', 80, pick(CLOTHING, ['Black', 'White', 'Red', 'Blue', 'Pink'])),
    colored('headwear', 'premium', 'Crown', 'Royalty', 'headwear-crown', 200, pick(METALS, ['Gold', 'Silver'])),

    // ── Facewear ──────────────────────────────────────────────────────────────
    colored('facewear', 'glasses', 'Round Glasses', 'Round wire frames', 'facewear-round', 40, pick(METALS, ['Black', 'Gold', 'Silver'])),
    colored('facewear', 'glasses', 'Sunglasses', 'Dark lenses', 'facewear-sunglasses', 50, pick(CLOTHING, ['Black', 'White', 'Red', 'Yellow'])),
    colored('facewear', 'glasses', 'Aviators', 'Tinted aviators', 'facewear-aviators', 70, { ...pick(METALS, ['Gold', 'Silver']), ...pick(CLOTHING, ['Blue', 'Pink']) }),
    colored('facewear', 'glasses', 'Monocle', 'Most distinguished', 'facewear-monocle', 80, pick(METALS, ['Gold', 'Silver'])),
    colored('facewear', 'other', 'Eye Patch', 'Arr', 'facewear-patch', 30, pick(CLOTHING, ['Black', 'Brown'])),
    colored('facewear', 'other', 'Face Mask', 'Cloth face mask', 'facewear-mask', 25, pick(CLOTHING, ['White', 'Black', 'Blue', 'Pink'])),

    // ── Wristwear ─────────────────────────────────────────────────────────────
    colored('wristwear', '', 'Watch', 'Classic wristwatch', 'wrist-watch', 50, pick(METALS, ['Gold', 'Silver', 'Black'])),
    colored('wristwear', '', 'Smartwatch', 'Counts your steps', 'wrist-smartwatch', 90, pick(CLOTHING, ['Black', 'White', 'Pink', 'Blue'])),
    colored('wristwear', '', 'Bracelet', 'Simple bangle', 'wrist-bracelet', 30, pick(METALS, ['Gold', 'Silver'])),
    colored('wristwear', '', 'Beaded Bracelet', 'Handmade beads', 'wrist-beads', 30, pick(CLOTHING, ['Brown', 'Blue', 'Pink', 'Purple'])),
    colored('wristwear', '', 'Sweatband', 'For serious workouts', 'wrist-sweatband', 25, pick(CLOTHING, ['White', 'Red', 'Blue', 'Yellow'])),

    // ── Footwear ──────────────────────────────────────────────────────────────
    // Sneakers' first variant is free and given to everyone at signup.
    {
        name: 'Sneakers',
        description: 'Everyday sneakers',
        subCategory: 'casual',
        category: 'footwear',
        isOverlappable: false,
        variants: [
            { name: 'White', color: CLOTHING.White, wearable: 'shoes-sneakers', price: coins(0) },
            ...colorways('shoes-sneakers', 40, pick(CLOTHING, ['Black', 'Red', 'Blue', 'Pink', 'Yellow'])),
        ],
    },
    colored('footwear', 'casual', 'High-Tops', 'Ankle-high sneakers', 'shoes-high-tops', 60, pick(CLOTHING, ['White', 'Black', 'Red', 'Navy'])),
    colored('footwear', 'casual', 'Slides', 'Easy on, easy off', 'shoes-slides', 25, pick(CLOTHING, ['Black', 'White', 'Pink', 'Blue'])),
    colored('footwear', 'casual', 'Sandals', 'Strappy sandals', 'shoes-sandals', 30, pick(CLOTHING, ['Brown', 'Black', 'Khaki'])),
    colored('footwear', 'boots', 'Boots', 'Sturdy boots', 'shoes-boots', 70, pick(CLOTHING, ['Brown', 'Black', 'Khaki'])),
    colored('footwear', 'formal', 'Dress Shoes', 'Polished and shiny', 'shoes-dress', 80, pick(CLOTHING, ['Black', 'Brown'])),

    // ── Tops ──────────────────────────────────────────────────────────────────
    colored('tops', 'casual', 'Tank Top', 'Sleeveless and breezy', 'top-tank', 40, pick(CLOTHING, ['White', 'Black', 'Grey', 'Red', 'Yellow'])),
    colored('tops', 'casual', 'Crop Top', 'Cropped tee', 'top-crop', 50, pick(CLOTHING, ['White', 'Black', 'Pink', 'Purple', 'Yellow'])),
    colored('tops', 'casual', 'Polo', 'Collared polo shirt', 'top-polo', 60, pick(CLOTHING, ['White', 'Navy', 'Green', 'Red', 'Pink'])),
    colored('tops', 'casual', 'Sweater', 'Warm knit sweater', 'top-sweater', 70, pick(CLOTHING, ['Grey', 'Navy', 'Red', 'Green', 'Khaki'])),
    colored('tops', 'casual', 'Hoodie', 'Comfy pullover hoodie', 'top-hoodie', 80, pick(CLOTHING, ['Black', 'Grey', 'Red', 'Blue', 'Yellow', 'Pink'])),
    colored('tops', 'sporty', 'Jersey', 'Team colours', 'top-jersey', 75, pick(CLOTHING, ['Red', 'Blue', 'Green', 'Yellow', 'Black'])),
    colored('tops', 'sporty', 'Track Jacket', 'Zip-up track jacket', 'top-track-jacket', 85, pick(CLOTHING, ['Black', 'Navy', 'Red', 'Green'])),
    colored('tops', 'formal', 'Button-Up Shirt', 'Crisp collared shirt', 'top-button-up', 90, pick(CLOTHING, ['White', 'Blue', 'Pink', 'Black'])),
    colored('tops', 'formal', 'Blazer', 'Sharp tailored blazer', 'top-blazer', 120, pick(CLOTHING, ['Black', 'Navy', 'Grey', 'Khaki'])),
    colored('tops', 'outerwear', 'Puffer Jacket', 'Warm and puffy', 'top-puffer', 130, pick(CLOTHING, ['Black', 'Red', 'Yellow', 'Navy', 'Purple'])),

    // ── Bottoms ───────────────────────────────────────────────────────────────
    colored('bottoms', 'casual', 'Shorts', 'Summer shorts', 'bottoms-shorts', 40, pick(CLOTHING, ['Denim', 'Khaki', 'Black', 'Navy'])),
    colored('bottoms', 'casual', 'Cargo Shorts', 'Shorts with pockets', 'bottoms-cargo-shorts', 50, pick(CLOTHING, ['Khaki', 'Green', 'Black'])),
    colored('bottoms', 'casual', 'Chinos', 'Smart casual chinos', 'bottoms-chinos', 70, pick(CLOTHING, ['Khaki', 'Navy', 'Black', 'Brown'])),
    colored('bottoms', 'casual', 'Ripped Jeans', 'Distressed denim', 'bottoms-ripped', 80, pick(CLOTHING, ['Denim', 'Black', 'Grey'])),
    colored('bottoms', 'casual', 'Skirt', 'A-line skirt', 'bottoms-skirt', 60, pick(CLOTHING, ['Black', 'Denim', 'Red', 'Pink', 'Yellow'])),
    colored('bottoms', 'sporty', 'Joggers', 'Cuffed joggers', 'bottoms-joggers', 60, pick(CLOTHING, ['Grey', 'Black', 'Navy', 'Green'])),
    colored('bottoms', 'sporty', 'Track Pants', 'With a side stripe', 'bottoms-track-pants', 65, pick(CLOTHING, ['Black', 'Navy', 'Red'])),
    colored('bottoms', 'sporty', 'Leggings', 'Stretchy leggings', 'bottoms-leggings', 45, pick(CLOTHING, ['Black', 'Grey', 'Purple', 'Pink'])),
];
