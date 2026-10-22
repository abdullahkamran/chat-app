import { useEffect, useRef } from 'react';

import type { ActorAction } from '@chat-app/shared-types';
import { SocketEvent } from '@chat-app/socket-constants';
import { socketUtils } from '@/utils/socketUtils';

interface ReceiveHandlers {
  onEnter: (payload: { userId: string }) => void;
  onExit: (payload: { userId: string }) => void;
  onPoint: (payload: { userId: string; x: number; y: number }) => void;
  onMessage: (payload: { userId: string; message: string }) => void;
  onTyping?: (payload: { userId: string }) => void;
  onAvatarChanged?: (payload: { userId: string }) => void;
  onAction?: (payload: { userId: string; action: ActorAction }) => void;
}

interface UseChatParams {
  roomId: string;
  userId: string;
  handlers: ReceiveHandlers;
  getMyPosition: () => { x: number; y: number };
  /**
   * A lasting action to announce in place of the position when someone enters, such
   * as sitting. Receivers walk the actor there themselves, so no point is sent.
   */
  getMyAction?: () => ActorAction | null;
  onEnterMe?: () => void;
  /**
   * The socket reconnected after a drop. Events during the gap were lost, so drop
   * remote characters; everyone present re-announces their position in reply to
   * our re-enter.
   */
  onReconnect?: () => void;
}

/** Every room event the server relays carries the room it came from. */
type RoomPayload<T> = T & { roomId: string };

export function useChat({ roomId, userId, handlers, getMyPosition, getMyAction, onEnterMe, onReconnect }: UseChatParams) {

  // Callers pass fresh closures every render. Keep the latest ones in refs so the
  // socket subscription below only resets when the room or user changes — otherwise
  // every re-render would emit SEND_EXIT + SEND_ENTER and re-register listeners.
  const handlersRef = useRef(handlers);
  const getMyPositionRef = useRef(getMyPosition);
  const getMyActionRef = useRef(getMyAction);
  const onEnterMeRef = useRef(onEnterMe);
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    handlersRef.current = handlers;
    getMyPositionRef.current = getMyPosition;
    getMyActionRef.current = getMyAction;
    onEnterMeRef.current = onEnterMe;
    onReconnectRef.current = onReconnect;
  });

  const pointMe = () => {
    if (!socketUtils.socket) return;
    const { x, y } = getMyPositionRef.current();
    socketUtils.socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
  };

  useEffect(() => {
    const socket = socketUtils.socket;
    if (!socket) return;

    // Tell others where we are: a lasting action (sitting) if there is one, else our position.
    const announceMe = () => {
      const action = getMyActionRef.current?.();
      if (action) {
        socket.emit(SocketEvent.SEND_ACTION, { roomId, action });
        return;
      }
      const { x, y } = getMyPositionRef.current();
      socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
    };

    // The socket is joined to every room the user belongs to, so it also receives
    // events from rooms other than the one on screen. Ignore those.
    const handleEnter = (p: RoomPayload<{ userId: string }>) => {
      if (p.roomId !== roomId) return;
      handlersRef.current.onEnter(p);
      announceMe();
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
    const handleTyping = (p: RoomPayload<{ userId: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onTyping?.(p);
    };
    const handleAvatarChanged = (p: RoomPayload<{ userId: string }>) => {
      if (p.roomId === roomId) handlersRef.current.onAvatarChanged?.(p);
    };
    const handleAction = (p: RoomPayload<{ userId: string; action: ActorAction }>) => {
      if (p.roomId === roomId) handlersRef.current.onAction?.(p);
    };

    // Fires only on reconnection, not the first connect. Emits made before the
    // socket is connected again are buffered and sent in order once it is.
    const handleReconnect = () => {
      if (!userId) return;
      onReconnectRef.current?.();
      socket.emit(SocketEvent.SEND_ENTER, { roomId });
      announceMe();
    };

    socket.on(SocketEvent.RECEIVE_ENTER, handleEnter);
    socket.on(SocketEvent.RECEIVE_EXIT, handleExit);
    socket.on(SocketEvent.RECEIVE_POINT, handlePoint);
    socket.on(SocketEvent.RECEIVE_MESSAGE, handleMessage);
    socket.on(SocketEvent.RECEIVE_TYPING, handleTyping);
    socket.on(SocketEvent.RECEIVE_AVATAR_CHANGED, handleAvatarChanged);
    socket.on(SocketEvent.RECEIVE_ACTION, handleAction);
    socket.io.on('reconnect', handleReconnect);

    if (userId) {
      socket.emit(SocketEvent.SEND_ENTER, { roomId });
      onEnterMeRef.current?.();
    }

    return () => {
      socket.emit(SocketEvent.SEND_EXIT, { roomId });
      socket.off(SocketEvent.RECEIVE_ENTER, handleEnter);
      socket.off(SocketEvent.RECEIVE_EXIT, handleExit);
      socket.off(SocketEvent.RECEIVE_POINT, handlePoint);
      socket.off(SocketEvent.RECEIVE_MESSAGE, handleMessage);
      socket.off(SocketEvent.RECEIVE_TYPING, handleTyping);
      socket.off(SocketEvent.RECEIVE_AVATAR_CHANGED, handleAvatarChanged);
      socket.off(SocketEvent.RECEIVE_ACTION, handleAction);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [roomId, userId]);

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
    pointMe,
  };
}
