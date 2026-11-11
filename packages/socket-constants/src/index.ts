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
  /** Ask someone in the room to do a mutual emote (high five): `{ roomId, animation, targetId }`. */
  SEND_EMOTE_REQUEST: "send_emote_request",
  /** Withdraw our pending mutual emote request: `{ roomId, requestId }`. */
  SEND_EMOTE_REQUEST_CANCEL: "send_emote_request_cancel",
  /** Answer a mutual emote request: `{ roomId, requestId, accept, at? }`, `at` being where we stand. */
  SEND_EMOTE_RESPONSE: "send_emote_response",
  /** Sent to both people: a mutual emote request was made (MutualEmoteRequest). */
  RECEIVE_EMOTE_REQUEST: "receive_emote_request",
  /** Sent to both people: a mutual emote request ended without starting (MutualEmoteRequestEnded). */
  RECEIVE_EMOTE_REQUEST_ENDED: "receive_emote_request_ended",
  /** Sent to the room: a mutual emote was accepted and starts (MutualEmoteStart). */
  RECEIVE_MUTUAL_EMOTE: "receive_mutual_emote",
  /** Do an interactive emote to someone (throw a tomato): `{ roomId, animation, targetId }`. */
  SEND_INTERACTION: "send_interaction",
  /** Sent to everyone else in the room (RoomInteraction). */
  RECEIVE_INTERACTION: "receive_interaction",
  /** The owner saved a new layout. Carries everyone the server stood up or moved off furniture, and where to. */
  RECEIVE_ROOM_ITEMS_CHANGED: "receive_room_items_changed",
  /** Sent to a user's own channel: they were added to a room, at creation or later. */
  RECEIVE_ADDED_TO_ROOM: "receive_added_to_room",
  /** Sent to a user's own channel: they were removed from a room, left it (on this or another device), or it was deleted. */
  RECEIVE_REMOVED_FROM_ROOM: "receive_removed_from_room",
  /** Sent to a room: someone was added, removed or left, or the owners changed (also to new owners' own channels). Refetch the member list. */
  RECEIVE_ROOM_MEMBERS_CHANGED: "receive_room_members_changed",
  /** Sent to a user's own channel: a friend request to or from them, or a friendship, was made or ended. Refetch friends and requests. */
  RECEIVE_FRIENDS_CHANGED: "receive_friends_changed",
  /** Sent to a personal room owner's own channel: a friend entered their room while they weren't there. */
  RECEIVE_ROOM_VISITED: "receive_room_visited",
  /** Sent to the own channel of everyone who can read it: mail was left in a room's postbox. */
  RECEIVE_ROOM_MAIL: "receive_room_mail",
} as const;

export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];
