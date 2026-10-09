import { Animation } from "./animation.types";
import { CharacterDirection, Dimensions, Orientiation, Position } from "./dimensions.types";
import { Item, ItemState } from "./item.types";
import { User } from "./user.types";

export interface Room {
    _id: string;
    ownerId: string;
    name: string;
    description: string;
    category: string;
    personLimit: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface RoomDetails extends Room {
    users: Array<User>;
    dimensions: Dimensions;
    items: Array<RoomItem>;
    doors: Array<Door>;
    theme: RoomTheme;
}

export interface RoomItem {
    itemId: Item;
    position: Position;
    orientation: Orientiation;
    state: ItemState; 
}

/** Isometric facing. S = toward the viewer, E = toward screen right. */
export const Facing = {
    NE: 'NE',
    NW: 'NW',
    SE: 'SE',
    SW: 'SW',
} as const;

export type Facing = (typeof Facing)[keyof typeof Facing];

/** What a character in a room is currently doing. Engines animate these; the room session owns them. */
export type ActorAction =
    | { kind: 'idle' }
    | { kind: 'walk'; path: Position[] }
    | { kind: 'sit'; itemId: Item['_id']; seatIndex: number }
    | { kind: 'emote'; animation: Animation['name'] };

export type ActorActionKind = ActorAction['kind'];

export interface RoomCharacter {
    user: User;
    position: Position;
    direction: CharacterDirection;
    messages: Array<string>;
    isTyping: boolean;
}

export interface Door {
    position: Position;
    dimensions: Dimensions;
    category: string;
    isEntry: boolean;
    // TODO: target room    
}

export interface RoomTheme {
    floor: Item;
    leftWall: Item;
    rightWall: Item;
}

export interface PaginatedRooms {
    rooms: Array<Room>;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
