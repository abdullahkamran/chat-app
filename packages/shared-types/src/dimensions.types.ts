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

export enum Orientiation {
    ZERO,
    NINETY,
    ONE_EIGHTY,
    TWO_SEVENTY,
}

export enum CharacterDirection {
    LEFT,
    RIGHT,
}
