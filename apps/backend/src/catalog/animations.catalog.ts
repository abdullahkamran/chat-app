import { Animation, AnimationCategory } from '@chat-app/shared-types';

type CatalogAnimation = Omit<Animation, '_id'>;

/**
 * Source of truth for all animations.
 * On startup, new entries here are inserted into the DB automatically.
 * Existing DB entries are never overwritten — to update a record in dev,
 * drop the `animations` collection and restart.
 */
export const ANIMATIONS_CATALOG: CatalogAnimation[] = [
    {
        name: 'walk',
        category: AnimationCategory.WALK,
        price: { coins: 0, cash: 0, realMoney: 0 },
    },
];
