export interface Dimensions {
    length: number;
    width: number;
    height: number;
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

export const CharacterDirection = {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
} as const;

export type CharacterDirection = (typeof CharacterDirection)[keyof typeof CharacterDirection];
