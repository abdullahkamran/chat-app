import { useEffect, useRef } from 'react';

import type { ActorAction, RoomOccupant, RoomPresenceState } from '@chat-app/shared-types';
import { SocketEvent } from '@chat-app/socket-constants';
import { socketUtils } from '@/utils/socketUtils';

type SitAction = Extract<ActorAction, { kind: 'sit' }>;

interface ReceiveHandlers {
  /** Someone entered. A re-entry after their reconnect carries where they were. */
  onEnter: (payload: { userId: string } & RoomPresenceState) => void;
  /** Everyone already in the room, sent to us alone each time we enter. */
  onPresence: (payload: { occupants: RoomOccupant[] }) => void;
  /** The server refused our sit because someone else holds that seat. */
  onSitRefused: (payload: { action: SitAction }) => void;
  onExit: (payload: { userId: string }) => void;
  onPoint: (payload: { userId: string; x: number; y: number }) => void;
  onMessage: (payload: { userId: string; message: string }) => void;
  onTyping?: (payload: { userId: string; username?: string }) => void;
  onAvatarChanged?: (payload: { userId: string }) => void;
  onAction?: (payload: { userId: string; action: ActorAction }) => void;
  /** The owner saved a new layout. `placed`: users the server stood up or moved off furniture, and where to. */
  onItemsChanged?: (payload: { placed: { userId: string; x: number; y: number }[] }) => void;
}

interface UseChatParams {
  roomId: string;
  userId: string;
  handlers: ReceiveHandlers;
  /** Where we are, sent with a re-entry after a reconnect so others place us there directly. */
  getMyState: () => RoomPresenceState;
  /** Enter only once this is true, e.g. when the room's doors and seats are known. */
  enabled: boolean;
  onEnterMe?: () => void;
  /**
   * The socket reconnected after a drop. Events during the gap were lost, so drop
   * remote characters; the server sends a fresh snapshot in reply to our re-enter.
   */
  onReconnect?: () => void;
}

/** Every room event the server relays carries the room it came from. */
type RoomPayload<T> = T & { roomId: string };

export function useChat({ roomId, userId, handlers, getMyState, enabled, onEnterMe, onReconnect }: UseChatParams) {

  // Callers pass fresh closures every render. Keep the latest ones in refs so the
  // socket subscription below only resets when the room or user changes — otherwise
  // every re-render would emit SEND_EXIT + SEND_ENTER and re-register listeners.
  const handlersRef = useRef(handlers);
  const getMyStateRef = useRef(getMyState);
  const onEnterMeRef = useRef(onEnterMe);
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    handlersRef.current = handlers;
    getMyStateRef.current = getMyState;
    onEnterMeRef.current = onEnterMe;
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    const socket = socketUtils.socket;
    if (!socket || !enabled) return;

    // The socket is joined to every room the user belongs to, so it also receives
    // events from rooms other than the one on screen. Ignore those.
    const handleEnter = (p: RoomPayload<{ userId: string } & RoomPresenceState>) => {
      if (p.roomId === roomId) handlersRef.current.onEnter(p);
    };
    const handlePresence = (p: RoomPayload<{ occupants: RoomOccupant[] }>) => {
      if (p.roomId === roomId) handlersRef.current.onPresence(p);
    };
    const handleSitRefused = (p: RoomPayload<{ action: SitAction }>) => {
      if (p.roomId === roomId) handlersRef.current.onSitRefused(p);
    };
    const handleExit = (p: RoomPayload<{ userId: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onExit(p);
    };
    const handlePoint = (p: RoomPayload<{ userId: string; x: number; y: number }>) => {
      if (p.roomId === roomId) handlersRef.current.onPoint(p);
    };
    const handleMessage = (p: RoomPayload<{ userId: string; message: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onMessage(p);
    };
    const handleTyping = (p: RoomPayload<{ userId: string; username?: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onTyping?.(p);
    };
    const handleAvatarChanged = (p: RoomPayload<{ userId: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onAvatarChanged?.(p);
    };
    const handleAction = (p: RoomPayload<{ userId: string; action: ActorAction }>) => {
      if (p.roomId === roomId) handlersRef.current.onAction?.(p);
    };
    const handleItemsChanged = (p: RoomPayload<{ placed: { userId: string; x: number; y: number }[] }>) => {
      if (p.roomId === roomId) handlersRef.current.onItemsChanged?.(p);
    };

    // Fires only on reconnection, not the first connect. Emits made before the
    // socket is connected again are buffered and sent in order once it is.
    const handleReconnect = () => {
      if (!userId) return;
      onReconnectRef.current?.();
      socket.emit(SocketEvent.SEND_ENTER, { roomId, ...getMyStateRef.current() });
    };

    socket.on(SocketEvent.RECEIVE_ENTER, handleEnter);
    socket.on(SocketEvent.RECEIVE_ROOM_PRESENCE, handlePresence);
    socket.on(SocketEvent.RECEIVE_SIT_REFUSED, handleSitRefused);
    socket.on(SocketEvent.RECEIVE_EXIT, handleExit);
    socket.on(SocketEvent.RECEIVE_POINT, handlePoint);
    socket.on(SocketEvent.RECEIVE_MESSAGE, handleMessage);
    socket.on(SocketEvent.RECEIVE_TYPING, handleTyping);
    socket.on(SocketEvent.RECEIVE_AVATAR_CHANGED, handleAvatarChanged);
    socket.on(SocketEvent.RECEIVE_ACTION, handleAction);
    socket.on(SocketEvent.RECEIVE_ROOM_ITEMS_CHANGED, handleItemsChanged);
    socket.io.on('reconnect', handleReconnect);

    if (userId) {
      socket.emit(SocketEvent.SEND_ENTER, { roomId });
      onEnterMeRef.current?.();
    }

    return () => {
      socket.emit(SocketEvent.SEND_EXIT, { roomId });
      socket.off(SocketEvent.RECEIVE_ENTER, handleEnter);
      socket.off(SocketEvent.RECEIVE_ROOM_PRESENCE, handlePresence);
      socket.off(SocketEvent.RECEIVE_SIT_REFUSED, handleSitRefused);
      socket.off(SocketEvent.RECEIVE_EXIT, handleExit);
      socket.off(SocketEvent.RECEIVE_POINT, handlePoint);
      socket.off(SocketEvent.RECEIVE_MESSAGE, handleMessage);
      socket.off(SocketEvent.RECEIVE_TYPING, handleTyping);
      socket.off(SocketEvent.RECEIVE_AVATAR_CHANGED, handleAvatarChanged);
      socket.off(SocketEvent.RECEIVE_ACTION, handleAction);
      socket.off(SocketEvent.RECEIVE_ROOM_ITEMS_CHANGED, handleItemsChanged);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [roomId, userId, enabled]);

  return {
    moveMe: (x: number, y: number) => {
      if (!socketUtils.socket) return;
      socketUtils.socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
    },
    sendMessage: (message: string) => {
      if (!socketUtils.socket) return;
      socketUtils.socket.emit(SocketEvent.SEND_MESSAGE, { roomId, message });
    },
    sendAction: (action: ActorAction) => {
      if (!socketUtils.socket) return;
      socketUtils.socket.emit(SocketEvent.SEND_ACTION, { roomId, action });
    },
    sendTyping: () => {
      if (!socketUtils.socket) return;
      socketUtils.socket.emit(SocketEvent.SEND_TYPING, { roomId });
    },
  };
}
