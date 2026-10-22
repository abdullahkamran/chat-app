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
