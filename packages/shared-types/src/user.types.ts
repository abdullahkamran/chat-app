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
    phoneNumber: string;
    city: string;
    state: string;
    country: string;
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
    rooms: Array<Room>;
    ownedRooms: Array<Room>;
    favouriteRooms: Array<Room>;
    friends: Array<User['_id']>;
    inventory: Array<Item['_id']>;
    avatarInventory: Array<AvatarInventoryEntry>;
    badges: Array<Badge>;
}

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
