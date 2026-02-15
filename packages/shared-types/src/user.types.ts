import { Avatar } from "./avatar.types";
import { Amount } from "./currency.types";
import { Room } from "./room.types";

export interface User {
    _id: string;
    username: string;
    password: string;
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
    emotes: Array<string>;
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
