/**
 * Source of truth for mandatory room defaults.
 * Applied to every room at creation time — both via the API and the signup default room.
 *
 * Theme item names must match Item.name values in items.catalog.ts.
 * If a named item doesn't exist in the DB at room creation time, a warning is logged
 * but creation still succeeds (theme slot will be null).
 */
export const ROOM_DEFAULTS_CATALOG = {
    /** Default person limit for every new room. Can be overridden by the room creator. */
    personLimit: 10,

    /**
     * Default RoomTheme — floor and both walls.
     * Names must match Item.name in items.catalog.ts.
     */
    theme: {
        floorItemName: 'Test Floor',
        leftWallItemName: 'Test Wallpaper',
        rightWallItemName: 'Test Wallpaper',
    },

    /**
     * Default doors placed in every new room.
     * The entry door (isEntry: true) is the default spawn point.
     */
    doors: [
        {
            position: { x: 0, y: 4, z: 0 },
            dimensions: { x: 1, y: 1, z: 2 },
            category: 'default',
            isEntry: true,
        },
    ] as Array<{
        position: { x: number; y: number; z: number };
        dimensions: { x: number; y: number; z: number };
        category: string;
        isEntry: boolean;
    }>,
};
