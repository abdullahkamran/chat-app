import { Animation } from "./animation.types";
import { Dimensions, Orientiation, Position } from "./dimensions.types";
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
    /** `at` is the placed item's grid position, which tells apart copies of the same item. */
    | { kind: 'sit'; itemId: Item['_id']; at: { x: number; y: number }; seatIndex: number }
    /** `elapsedMs` is how far in the emote already is, for someone who sees it start late. */
    | { kind: 'emote'; animation: Animation['name']; elapsedMs?: number };

export type ActorActionKind = ActorAction['kind'];

/** Where a user is in a room: the point they stand on or walk to, and a lasting action. */
export interface RoomPresenceState {
    /** Absent until they first move; they are still at the entry door. */
    position?: { x: number; y: number };
    /** Seated, or partway through an emote. Absent when standing or walking. */
    action?: Extract<ActorAction, { kind: 'sit' | 'emote' }>;
}

/** Someone already in a room, as the server sends it to a newcomer (`RECEIVE_ROOM_PRESENCE`). */
export interface RoomOccupant extends RoomPresenceState {
    userId: User['_id'];
    /** Recent chat messages, oldest first, with how long ago each was sent; their bubbles may still be up. */
    bubbles?: { text: string; elapsedMs: number }[];
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
