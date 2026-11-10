import { Amount } from './currency.types';

export interface Animation {
    _id: string;
    name: string; // camelCase string unique identifier
    category: AnimationCategory;
    /** For an EMOTE: who takes part. Absent means `solo`. */
    emoteType?: EmoteType;
    price: Amount;
}

/**
 * How many people an emote involves:
 * - `solo`: the user alone (wave, dance).
 * - `mutual`: the user and someone who agrees to it (high five). The initiator walks over and both play their part.
 * - `interactive`: done to someone without asking (throw a tomato), from wherever the user stands.
 */
export const EmoteType = {
    SOLO: 'solo',
    MUTUAL: 'mutual',
    INTERACTIVE: 'interactive',
} as const;

export type EmoteType = (typeof EmoteType)[keyof typeof EmoteType];

export const AnimationCategory = {
    EMOTE: 'EMOTE',
    WALK: 'WALK',
    SIT: 'SIT',
} as const;

export type AnimationCategory = (typeof AnimationCategory)[keyof typeof AnimationCategory];

export interface PaginatedAnimations {
    animations: Animation[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
