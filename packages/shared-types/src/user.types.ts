import { Animation } from "./animation.types";
import { Avatar, AvatarInventoryEntry } from "./avatar.types";
import { Amount } from "./currency.types";
import { Item } from "./item.types";
import { Room } from "./room.types";

export interface User {
    _id: string;
    username: string;
    password: string;
    email: string;
    /** E.164. Optional: only used to find friends through contacts. */
    phoneNumber?: string;
    city?: string;
    state?: string;
    country?: string;
    /** ISO date (YYYY-MM-DD). Asked at signup; users from before that have none. Never shown to others. */
    dateOfBirth?: string;
    lastLogin: number;
    lastActive: number;
    lastLocation: UserLocation;
    avatars: Array<Avatar['_id']>;
    selectedAvatar: Avatar['_id'];
    mood: Mood;
    level: number;
    animations: Array<Animation['_id']>;
    attributes: UserAttributes;
    amount: Amount;
    respecc: number;
    popularity: number;
    drip: number;
    maxRooms: number;
    favouriteRooms: Array<Room>;
    /** Room items free to place: item ID → copies. Placed copies aren't counted (see InventoryEntry). */
    inventory: Record<Item['_id'], number>;
    avatarInventory: Array<AvatarInventoryEntry>;
    badges: Array<Badge>;
    /** Whether people who have this user's number in their contacts see them in Quick Add. */
    discoverableByPhone: boolean;
}

/** What any signed-in user may see about another: search results, room member lists. */
export type PublicUser = Pick<User, '_id' | 'username' | 'level'>;

export interface UserAttributes {
    speed: number;
    maxSpeed: number;
    bubbleDuration: number; // milliseconds
    maxBubbleDuration: number; // milliseconds
}

export type Mood = string;

export interface UserLocation {
    x: string;
    y: string;
    z: string;
}

export interface Badge {
    rizz: number;
    simp: number;
    delulu: number;
    goat: number;
    sus: number;
}
