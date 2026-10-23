import { Animation } from "./animation.types";
import { Dimensions, Orientiation, Position } from "./dimensions.types";
import { Item, ItemState } from "./item.types";
import { PublicUser, User } from "./user.types";

/**
 * What kind of room it is. Every user has exactly one personal room, made at signup: no members,
 * and open to the owner's friends (like a DM). Group rooms are the ones users create and add people to.
 */
export const RoomCategory = {
    PERSONAL: 'personal',
    GROUP: 'group',
} as const;

export type RoomCategory = (typeof RoomCategory)[keyof typeof RoomCategory];

export interface Room {
    _id: string;
    ownerId: string;
    name: string;
    description: string;
    category: RoomCategory;
    personLimit: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface RoomDetails extends Room {
    members: Array<PublicUser>;
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

/** `GET /rooms/:roomId/members`: the owner, everyone else, and what the caller may do. */
export interface RoomMembers {
    owner: PublicUser;
    members: Array<PublicUser>;
    /** Most people the room holds, owner included. */
    personLimit: number;
    /** Whether the caller may add and remove members (the owner today; room admins later). */
    canManageMembers: boolean;
}

/**
 * Why a user can no longer be in a room (`RECEIVE_REMOVED_FROM_ROOM`): removed by a manager, left,
 * or no longer friends with the owner of a personal room they could visit.
 */
export type RoomRemovalReason = 'removed' | 'left' | 'unfriended';

/** `RECEIVE_ROOM_VISITED`, to a personal room's owner: a friend came in while they weren't there. */
export interface RoomVisit {
    roomId: string;
    userId: string;
    username: string;
}

/** A note left in a room's postbox. It stays until its author or the room owner deletes it. */
export interface RoomMail {
    _id: string;
    roomId: string;
    author: PublicUser;
    text: string;
    createdAt: Date;
}

/** `GET /rooms/:roomId/mail`: the postbox as the caller sees it. */
export interface RoomMailbox {
    /** Newest first. In a personal room a visitor sees only their own; the owner sees all. */
    mails: Array<RoomMail>;
    /** Mail from others that arrived since the caller last opened the postbox. */
    unread: number;
    /** Whether the caller may leave mail. Not the owner of a personal room: it is their inbox. */
    canPost: boolean;
}

/** `RECEIVE_ROOM_MAIL`, to everyone who can read the new mail. */
export interface RoomMailNotice {
    roomId: string;
    roomName: string;
    username: string;
}

/** Longest postbox note, in characters. */
export const ROOM_MAIL_MAX_LENGTH = 500;

export interface PaginatedRooms {
    rooms: Array<Room>;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
