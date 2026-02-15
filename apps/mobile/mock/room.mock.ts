import { Room, RoomItem, Door, RoomTheme } from "@chat-app/shared-types";
import { mockDimensions, mockPositions, mockOrientations } from "./dimensions.mock";
import { mockItems } from "./item.mock";
import { ItemState } from "@chat-app/shared-types";

export const mockRoomThemes: RoomTheme[] = [
    {
        floor: mockItems[0]._id,
        leftWall: mockItems[2]._id,
        rightWall: mockItems[2]._id,
    },
    {
        floor: mockItems[1]._id,
        leftWall: mockItems[3]._id,
        rightWall: mockItems[3]._id,
    },
    {
        floor: mockItems[2]._id,
        leftWall: mockItems[0]._id,
        rightWall: mockItems[1]._id,
    },
];

export const mockRoomItems: RoomItem[] = [
    {
        itemId: mockItems[0]._id,
        position: mockPositions[0],
        orientation: mockOrientations[0],
        state: ItemState.ACTIVE,
    },
    {
        itemId: mockItems[1]._id,
        position: mockPositions[1],
        orientation: mockOrientations[1],
        state: ItemState.ACTIVE,
    },
    {
        itemId: mockItems[2]._id,
        position: mockPositions[2],
        orientation: mockOrientations[2],
        state: ItemState.INACTIVE,
    },
    {
        itemId: mockItems[3]._id,
        position: mockPositions[3],
        orientation: mockOrientations[3],
        state: ItemState.ACTIVE,
    },
];

export const mockDoors: Door[] = [
    {
        position: mockPositions[0],
        dimensions: mockDimensions[0],
        category: "Main Entrance",
        isEntry: true,
    },
    {
        position: mockPositions[1],
        dimensions: mockDimensions[1],
        category: "Side Door",
        isEntry: false,
    },
    {
        position: mockPositions[2],
        dimensions: mockDimensions[2],
        category: "Back Door",
        isEntry: false,
    },
];

export const mockRooms: Room[] = [
    {
        _id: "room_001",
        ownerId: "user_001",
        name: "Cozy Living Room",
        description: "A warm and inviting living space",
        category: "Living Room",
        personLimit: 10,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-20T14:30:00Z"),
        dimensions: mockDimensions[0],
        items: [mockRoomItems[0], mockRoomItems[1]],
        door: [mockDoors[0]],
        theme: mockRoomThemes[0],
    },
    {
        _id: "room_002",
        ownerId: "user_002",
        name: "Modern Office",
        description: "A sleek and professional workspace",
        category: "Office",
        personLimit: 5,
        createdAt: new Date("2024-02-01T09:00:00Z"),
        updatedAt: new Date("2024-02-10T16:45:00Z"),
        dimensions: mockDimensions[1],
        items: [mockRoomItems[1], mockRoomItems[2]],
        door: [mockDoors[0], mockDoors[1]],
        theme: mockRoomThemes[1],
    },
    {
        _id: "room_003",
        ownerId: "user_001",
        name: "Relaxation Zone",
        description: "A peaceful space for unwinding",
        category: "Bedroom",
        personLimit: 8,
        createdAt: new Date("2024-02-15T11:00:00Z"),
        updatedAt: new Date("2024-02-20T10:15:00Z"),
        dimensions: mockDimensions[2],
        items: [mockRoomItems[2], mockRoomItems[3]],
        door: [mockDoors[0]],
        theme: mockRoomThemes[2],
    },
    {
        _id: "room_004",
        ownerId: "user_003",
        name: "Party Central",
        description: "The ultimate party destination",
        category: "Entertainment",
        personLimit: 50,
        createdAt: new Date("2024-03-01T12:00:00Z"),
        updatedAt: new Date("2024-03-05T18:00:00Z"),
        dimensions: mockDimensions[4],
        items: [mockRoomItems[0], mockRoomItems[1], mockRoomItems[2], mockRoomItems[3]],
        door: [mockDoors[0], mockDoors[1], mockDoors[2]],
        theme: mockRoomThemes[0],
    },
    {
        _id: "room_005",
        ownerId: "user_002",
        name: "Gaming Den",
        description: "A dedicated space for gaming enthusiasts",
        category: "Gaming",
        personLimit: 12,
        createdAt: new Date("2024-03-10T15:00:00Z"),
        updatedAt: new Date("2024-03-12T20:30:00Z"),
        dimensions: mockDimensions[3],
        items: [mockRoomItems[1], mockRoomItems[3]],
        door: [mockDoors[0]],
        theme: mockRoomThemes[1],
    },
];

