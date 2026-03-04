/**
 * Default resources granted to every new user on signup.
 *
 * Items are referenced by name (not ObjectId) so the config survives DB reseeds.
 * If a named item doesn't exist in the DB at signup time, a warning is logged
 * but the signup itself still succeeds.
 */
export const SIGNUP_DEFAULTS = {
    /** Initial wallet balance credited to the new user. */
    wallet: {
        coins: 500,
        cash: 0,
        realMoney: 0,
    },

    /** Animation names (must match Animation.name in DB) to grant on signup. */
    animationNames: ['walk'] as string[],

    /**
     * Avatar item variants to add to the user's avatarInventory on signup.
     * itemName must match AvatarItem.name in DB.
     * variantName must match the variant's name field (not its _id).
     */
    avatarItemVariants: [
        // required parts
        { itemName: 'Default Skin', variantName: 'Default' },
        { itemName: 'Normal Face',  variantName: 'Default' },
        { itemName: 'Test Eyes 1',  variantName: 'Default' },
        { itemName: 'Normal Nose',  variantName: 'Default' },
        { itemName: 'Happy Mouth',  variantName: 'Default' },
        // clothing
        { itemName: 'T-Shirt',      variantName: 'Default' },
        { itemName: 'Jeans',        variantName: 'Default' },
        // hair (optional — all current styles unlocked by default)
        { itemName: 'Center Parted', variantName: 'Default' },
        { itemName: 'Puffed',        variantName: 'Default' },
        { itemName: 'Spiked',        variantName: 'Default' },
    ] as Array<{ itemName: string; variantName: string }>,

    /** Room item names (must match Item.name in DB) to add to the user's inventory on signup. */
    inventoryItemNames: ['Test Chair', 'Test Table'] as string[],

    /** Config for the default room created and owned by the new user. */
    defaultRoom: {
        name: 'My Room',
        description: 'Welcome to my room!',
        category: 'personal',
        personLimit: 10,
        dimensions: { length: 10, width: 10, height: 5 },
    },
};
