/**
 * Experimental on-screen joystick for walking in rooms, alongside tap-to-walk.
 * Off unless the build sets EXPO_PUBLIC_ROOM_JOYSTICK=1 (see ROOM_ENGINE.md, "Joystick").
 */
export const JOYSTICK_ENABLED = process.env.EXPO_PUBLIC_ROOM_JOYSTICK === '1';

/** How often a steering user's position goes to the server, in ms. */
export const STEER_REPORT_MS = 200;

/**
 * How far ahead of the drawn position each report points, in ms of walking. Others see a
 * walk toward that point, which should last until the next report arrives; slightly more
 * than STEER_REPORT_MS covers network jitter, so their view of us doesn't stop and start.
 */
export const STEER_LEAD_MS = 250;

/** Half the width of the body that collides with furniture, in grid cells. */
export const STEER_BODY_RADIUS = 0.2;

/** Longest frame step, in seconds, so a dropped frame can't step through a corner. */
export const STEER_MAX_DT = 0.05;
