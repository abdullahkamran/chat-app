export interface Dimensions {
    x: number;
    y: number;
    z: number;
}

export interface Position {
    x: number;
    y: number;
    z: number;
}

export const Orientiation = {
    ZERO: 'ZERO',
    NINETY: 'NINETY',
    ONE_EIGHTY: 'ONE_EIGHTY',
    TWO_SEVENTY: 'TWO_SEVENTY',
} as const;

export type Orientiation = (typeof Orientiation)[keyof typeof Orientiation];

/**
 * Floor size of every room, personal and group, in grid cells (z is unused for rooms).
 * Rooms can't be resized yet; rooms may grow later, so read a room's own `dimensions`
 * rather than assuming this.
 */
export const DEFAULT_ROOM_DIMENSIONS: Dimensions = { x: 10, y: 10, z: 0 };
