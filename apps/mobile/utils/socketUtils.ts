import { Socket } from 'socket.io-client';

export interface SocketUtils {
  socket: Socket | null;
}

export const socketUtils: SocketUtils = { socket: null };
