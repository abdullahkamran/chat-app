import { Dimensions, Position, Orientiation } from "@chat-app/shared-types";

export const mockDimensions: Dimensions[] = [
    {
        length: 10,
        width: 10,
        height: 3,
    },
    {
        length: 15,
        width: 12,
        height: 4,
    },
    {
        length: 20,
        width: 15,
        height: 5,
    },
    {
        length: 8,
        width: 8,
        height: 2.5,
    },
    {
        length: 25,
        width: 20,
        height: 6,
    },
];

export const mockPositions: Position[] = [
    {
        x: 0,
        y: 0,
        z: 0,
    },
    {
        x: 5,
        y: 5,
        z: 0,
    },
    {
        x: 10,
        y: 10,
        z: 0,
    },
    {
        x: -5,
        y: -5,
        z: 0,
    },
    {
        x: 15,
        y: 8,
        z: 1,
    },
];

export const mockOrientations: Orientiation[] = [
    Orientiation.ZERO,
    Orientiation.NINETY,
    Orientiation.ONE_EIGHTY,
    Orientiation.TWO_SEVENTY,
];

