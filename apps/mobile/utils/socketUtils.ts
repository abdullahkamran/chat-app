import type { QueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import type { RoomMailNotice, RoomVisit } from '@chat-app/shared-types';
import { SocketEvent } from '@chat-app/socket-constants';
import { showToast } from '@/components/Toast';
import { refetchFriendData } from '@/hooks/useFriends';
import { mailboxKey } from '@/hooks/useMailbox';

export interface SocketUtils {
  socket: Socket | null;
}

export const socketUtils: SocketUtils = { socket: null };

/** Tell the rooms this user stands in to refetch their avatar. Call after the selected avatar changes. */
export function announceAvatarChanged() {
  socketUtils.socket?.emit(SocketEvent.SEND_AVATAR_CHANGED);
}

/**
 * Refetch the room list when this user is added to or removed from a room, a room's
 * member list when someone joins or leaves it, friend lists and requests when those
 * change (and the room list, which holds friends' personal rooms), and a postbox when
 * mail arrives in it. A friend visiting the user's room, and new mail, show a toast.
 * Returns a function that stops listening.
 */
export function listenForAccountEvents(socket: Socket, queryClient: QueryClient): () => void {
  const refetchRooms = () => queryClient.invalidateQueries({ queryKey: ['rooms'] });
  const refetchMembers = ({ roomId }: { roomId: string }) =>
    queryClient.invalidateQueries({ queryKey: ['roomMembers', roomId] });

  const refetchFriends = () => {
    refetchFriendData(queryClient);
    refetchRooms();
  };
  const onVisited = ({ username }: RoomVisit) =>
    showToast({ text: `${username} visited your room`, icon: 'home' });
  const onMail = ({ roomId, roomName, username }: RoomMailNotice) => {
    queryClient.invalidateQueries({ queryKey: mailboxKey(roomId) });
    showToast({ text: `${username} left a mail in ${roomName}`, icon: 'mail' });
  };

  socket.on(SocketEvent.RECEIVE_ADDED_TO_ROOM, refetchRooms);
  socket.on(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, refetchRooms);
  socket.on(SocketEvent.RECEIVE_ROOM_MEMBERS_CHANGED, refetchMembers);
  socket.on(SocketEvent.RECEIVE_FRIENDS_CHANGED, refetchFriends);
  socket.on(SocketEvent.RECEIVE_ROOM_VISITED, onVisited);
  socket.on(SocketEvent.RECEIVE_ROOM_MAIL, onMail);
  return () => {
    socket.off(SocketEvent.RECEIVE_ADDED_TO_ROOM, refetchRooms);
    socket.off(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, refetchRooms);
    socket.off(SocketEvent.RECEIVE_ROOM_MEMBERS_CHANGED, refetchMembers);
    socket.off(SocketEvent.RECEIVE_FRIENDS_CHANGED, refetchFriends);
    socket.off(SocketEvent.RECEIVE_ROOM_VISITED, onVisited);
    socket.off(SocketEvent.RECEIVE_ROOM_MAIL, onMail);
  };
}
