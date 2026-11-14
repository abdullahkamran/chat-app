import { Animation, AnimationCategory, EmoteType } from '@chat-app/shared-types';

type CatalogAnimation = Omit<Animation, '_id'>;

/**
 * Source of truth for all animations.
 * On startup, new entries here are inserted into the DB automatically.
 * Existing DB entries are never overwritten, except `description`, which always follows
 * the catalog. To update anything else in dev, drop the `animations` collection and restart.
 */
export const ANIMATIONS_CATALOG: CatalogAnimation[] = [
    {
        name: 'walk',
        description: 'One foot, then the other. A timeless classic.',
        category: AnimationCategory.WALK,
        price: { coins: 0, cash: 0, realMoney: 0 },
    },
    // Emotes: each name needs a matching clip in the mobile Skia engine (skeleton/clips.ts).
    // `wave` is the free emote every user gets (signup-defaults.config.ts); the rest are sold.
    {
        name: 'wave',
        description: 'Hi! Hello! Over here! Yes, you!',
        category: AnimationCategory.EMOTE,
        price: { coins: 0, cash: 0, realMoney: 0 },
    },
    {
        name: 'clap',
        description: 'For when something deserves a round of applause.',
        category: AnimationCategory.EMOTE,
        price: { coins: 25, cash: 0, realMoney: 0 },
    },
    {
        name: 'laugh',
        description: 'Head back, belly held, full-body giggles.',
        category: AnimationCategory.EMOTE,
        price: { coins: 25, cash: 0, realMoney: 0 },
    },
    {
        name: 'dance',
        description: 'Bust a move. Nobody is judging. Well, kindly.',
        category: AnimationCategory.EMOTE,
        price: { coins: 50, cash: 0, realMoney: 0 },
    },
    ...([
        ['thumbsUp', 25, 'Nice. Cool. Approved.'],
        ['shrug', 25, 'Who knows? Not you, and that\'s fine.'],
        ['point', 25, 'Look over there! No, there!'],
        ['facepalm', 30, 'For when words just aren\'t enough.'],
        ['bow', 30, 'Thank you, thank you, you\'re too kind.'],
        ['cry', 35, 'Let it all out. Big sobs welcome.'],
        ['blowKiss', 40, 'Mwah! Sent with love, delivered by air.'],
        ['cheer', 40, 'Arms up, we\'re winning! Probably!'],
        ['jump', 40, 'Boing! Pure, springy joy.'],
        ['flex', 50, 'Check out these mighty little arms.'],
        ['moonwalk', 200, 'Glide backwards like the floor is made of butter.'],
    ] as const).map(([name, coins, description]): CatalogAnimation => ({
        name,
        description,
        category: AnimationCategory.EMOTE,
        price: { coins, cash: 0, realMoney: 0 },
    })),
    // Mutual emotes: the other person accepts, the initiator walks over and both play their part.
    // Only the initiator needs to own one. Each has a clip per role in the mobile engine (emotes.ts).
    ...([
        ['highFive', 60, 'Up top! Takes two, stings a little.'],
        ['hug', 60, 'A big cozy squeeze. They have to say yes first!'],
    ] as const).map(([name, coins, description]): CatalogAnimation => ({
        name,
        description,
        category: AnimationCategory.EMOTE,
        emoteType: EmoteType.MUTUAL,
        price: { coins, cash: 0, realMoney: 0 },
    })),
    // Interactive emotes: done to someone from wherever the user stands, without asking.
    ...([
        ['throwTomato', 80, 'Splat! Boo anyone off the stage, from across the room.'],
        ['throwSnowball', 80, 'Poof! A cold, fluffy surprise for your favourite person.'],
    ] as const).map(([name, coins, description]): CatalogAnimation => ({
        name,
        description,
        category: AnimationCategory.EMOTE,
        emoteType: EmoteType.INTERACTIVE,
        price: { coins, cash: 0, realMoney: 0 },
    })),
];
