import { Animation } from "./animation.types";
import { Dimensions, Orientiation, Position } from "./dimensions.types";
import { Item, ItemState, RoomThemeSlot } from "./item.types";
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
    /** Who made the room. For a personal room, whose it is. Rights go by `owners`, not this. */
    ownerId: string;
    /**
     * Who may manage the room: add and remove people, make others owners, edit it, delete it.
     * A group room's creator is its first owner, and an owner can make any member one too. A
     * personal room's only owner is `ownerId`. Use `isRoomOwner`.
     */
    owners: string[];
    name: string;
    description: string;
    category: RoomCategory;
    personLimit: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface RoomDetails extends Room {
    /** Everyone in a group room, its owners included. Empty for a personal room. */
    members: Array<PublicUser>;
    dimensions: Dimensions;
    items: Array<RoomItem>;
    doors: Array<Door>;
    theme: RoomTheme;
}

export interface RoomItem {
    /** Absent on a copy placed in edit mode and not saved yet. */
    _id?: string;
    itemId: Item;
    position: Position;
    orientation: Orientiation;
    state: ItemState;
    /**
     * Whose copy it is: who placed it. Any owner may move or remove it; removed, it goes back to
     * this user's inventory. Absent on a copy not saved yet (it's the editor's).
     */
    placedBy?: User['_id'];
}

/**
 * `PATCH /rooms/:roomId/items`: the room's items as the editor left them. A saved item keeps its
 * `_id` (moved, turned or left alone); a new one has none and comes out of the editor's inventory.
 * Saved items missing from `items` were removed, but only those in `knownItemIds`: items another
 * owner placed or removed meanwhile are left as they are, so two owners editing at once don't undo
 * each other.
 */
export interface RoomItemsUpdate {
    items: Array<Pick<RoomItem, '_id' | 'position' | 'orientation' | 'state'> & { itemId: Item['_id'] }>;
    /** The saved items' IDs when the editor started. */
    knownItemIds: string[];
    theme?: Partial<Record<RoomThemeSlot, Item['_id'] | null>> | null;
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

/** How long the asked person has to answer a mutual emote before it lapses. */
export const MUTUAL_EMOTE_REQUEST_MS = 15_000;
/** Grid cells between the two people of a mutual emote, along one grid axis so they face each other squarely. */
export const MUTUAL_EMOTE_GAP = 0.7;

/**
 * `RECEIVE_EMOTE_REQUEST`, to both people: `fromUserId` asks `toUserId` to do a mutual emote.
 * The asked person answers with `SEND_EMOTE_RESPONSE`; the asker may withdraw with `SEND_EMOTE_REQUEST_CANCEL`.
 */
export interface MutualEmoteRequest {
    requestId: string;
    roomId: string;
    fromUserId: User['_id'];
    toUserId: User['_id'];
    animation: Animation['name'];
    /** Milliseconds left to answer, as the server sent it. */
    expiresInMs: number;
}

/** Why a mutual emote request ended without starting. */
export type MutualEmoteEndReason = 'declined' | 'expired' | 'cancelled' | 'left' | 'noRoom';

/** `RECEIVE_EMOTE_REQUEST_ENDED`, to both people. */
export interface MutualEmoteRequestEnded {
    roomId: string;
    requestId: string;
    reason: MutualEmoteEndReason;
}

/**
 * `RECEIVE_MUTUAL_EMOTE`, to the whole room: the request was accepted. The server picked where
 * each stands; every client walks them there (standing up first if seated), turns them to
 * face each other and plays each one's part once both have arrived.
 */
export interface MutualEmoteStart {
    roomId: string;
    requestId: string;
    animation: Animation['name'];
    initiatorId: User['_id'];
    targetId: User['_id'];
    initiatorAt: { x: number; y: number };
    targetAt: { x: number; y: number };
}

/** `RECEIVE_INTERACTION`, to everyone else in the room: `userId` did an interactive emote to `targetId`. */
export interface RoomInteraction {
    roomId: string;
    userId: User['_id'];
    targetId: User['_id'];
    animation: Animation['name'];
}

export interface Door {
    position: Position;
    dimensions: Dimensions;
    category: string;
    isEntry: boolean;
    // TODO: target room
}

/**
 * The door every room gets: on the left wall (a door at x = 0 stands on the left wall, one at
 * y = 0 on the right), in its third column from the screen's left in a default 10x10 room,
 * one cell wide and two rows tall. People come in on its cell.
 */
export const DEFAULT_ENTRY_DOOR: Door = {
    position: { x: 0, y: 7, z: 0 },
    dimensions: { x: 1, y: 1, z: 2 },
    category: 'default',
    isEntry: true,
};

/** The room's entry door, or the default one when it has none (rooms made before doors were saved). */
export function entryDoorOf(doors: readonly Door[] | null | undefined): Door {
    return doors?.find(d => d.isEntry) ?? DEFAULT_ENTRY_DOOR;
}

/** The room's doors, with the default entry door added when none of them is an entry. */
export function withEntryDoor(doors: readonly Door[] | null | undefined): Door[] {
    const list = doors ?? [];
    return list.some(d => d.isEntry) ? [...list] : [...list, DEFAULT_ENTRY_DOOR];
}

export interface RoomTheme {
    floor: Item;
    leftWall: Item;
    rightWall: Item;
}

/** Whether the user is one of the room's owners. */
export function isRoomOwner(room: Pick<Room, 'owners'>, userId: string | null | undefined): boolean {
    return !!userId && (room.owners ?? []).includes(userId);
}

/** `GET /rooms/:roomId/members`: who is in the room, and what the caller may do. */
export interface RoomMembers {
    /** Everyone in the room, owners first, then by username. */
    members: Array<PublicUser>;
    /** Which of `members` own the room. */
    ownerIds: string[];
    /**
     * The room's creator while they own it, else null. As in WhatsApp, other owners can't remove
     * the creator or dismiss them as an owner.
     */
    creatorId: string | null;
    /** Most people the room holds, owners included. */
    personLimit: number;
    /** Whether the caller may add and remove people, make and dismiss owners and delete the room: an owner. */
    canManageMembers: boolean;
}

/** `POST /rooms/:roomId/leave`: what leaving did to the room. */
export interface RoomLeaveResult {
    /** The last person left, so the room was deleted. */
    deleted: boolean;
    /** The last owner left, so this member was picked at random to own the room. */
    newOwnerId?: string;
}

/**
 * Why a user can no longer be in a room (`RECEIVE_REMOVED_FROM_ROOM`): removed by an owner, left,
 * an owner deleted the room, or no longer friends with the owner of a personal room they could visit.
 */
export type RoomRemovalReason = 'removed' | 'left' | 'deleted' | 'unfriended';

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
