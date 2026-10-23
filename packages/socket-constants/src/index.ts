export const SocketEvent = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  RECEIVE_MESSAGE: "receive_message",
  RECEIVE_ENTER: "receive_enter",
  RECEIVE_EXIT: "receive_exit",
  RECEIVE_POINT: "receive_point",
  SEND_ENTER: "send_enter",
  SEND_EXIT: "send_exit",
  SEND_POINT: "send_point",
  SEND_MESSAGE: "send_message",
  SEND_TYPING: "send_typing",
  RECEIVE_TYPING: "receive_typing",
  SEND_AVATAR_CHANGED: "send_avatar_changed",
  RECEIVE_AVATAR_CHANGED: "receive_avatar_changed",
  SEND_ACTION: "send_action",
  RECEIVE_ACTION: "receive_action",
  /** Sent only to a user entering a room: everyone already there. */
  RECEIVE_ROOM_PRESENCE: "receive_room_presence",
  /** Sent only to a user whose sit was for a seat someone else holds. */
  RECEIVE_SIT_REFUSED: "receive_sit_refused",
  /** The owner saved a new layout. Carries everyone the server stood up or moved off furniture, and where to. */
  RECEIVE_ROOM_ITEMS_CHANGED: "receive_room_items_changed",
  /** Sent to a user's own channel: they were added to a room, at creation or later. */
  RECEIVE_ADDED_TO_ROOM: "receive_added_to_room",
  /** Sent to a user's own channel: they were removed from a room, or left it (on this or another device). */
  RECEIVE_REMOVED_FROM_ROOM: "receive_removed_from_room",
  /** Sent to a room: someone was added, removed or left. Refetch the member list. */
  RECEIVE_ROOM_MEMBERS_CHANGED: "receive_room_members_changed",
} as const;

export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];
