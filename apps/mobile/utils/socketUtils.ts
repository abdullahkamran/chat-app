import type { QueryClient } from '@tanstack/react-query';
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

/**
 * Refetch the room list when this user is added to or removed from a room, and a room's
 * member list when someone joins or leaves it. Returns a function that stops listening.
 */
export function listenForMembershipChanges(socket: Socket, queryClient: QueryClient): () => void {
  const refetchRooms = () => queryClient.invalidateQueries({ queryKey: ['rooms'] });
  const refetchMembers = ({ roomId }: { roomId: string }) =>
    queryClient.invalidateQueries({ queryKey: ['roomMembers', roomId] });

  socket.on(SocketEvent.RECEIVE_ADDED_TO_ROOM, refetchRooms);
  socket.on(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, refetchRooms);
  socket.on(SocketEvent.RECEIVE_ROOM_MEMBERS_CHANGED, refetchMembers);
  return () => {
    socket.off(SocketEvent.RECEIVE_ADDED_TO_ROOM, refetchRooms);
    socket.off(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, refetchRooms);
    socket.off(SocketEvent.RECEIVE_ROOM_MEMBERS_CHANGED, refetchMembers);
  };
}
