import { Socket } from 'socket.io-client';
import { SocketEvent } from '@chat-app/socket-constants';

export interface SocketUtils {
  socket: Socket | null;
}

export const socketUtils: SocketUtils = { socket: null };

/** Tell the rooms this user stands in to refetch their avatar. Call after the selected avatar changes. */
export function announceAvatarChanged() {
  socketUtils.socket?.emit(SocketEvent.SEND_AVATAR_CHANGED);
}
