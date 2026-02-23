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
    door: Array<Door>;
    theme: RoomTheme;
}

export interface RoomItem {
    itemId: Item;
    position: Position;
    orientation: Orientiation;
    state: ItemState; 
}

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
