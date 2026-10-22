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
} as const;

export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];
