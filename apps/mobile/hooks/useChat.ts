import { useEffect, useRef } from 'react';

import { SocketEvent } from '@chat-app/socket-constants';
import { socketUtils } from '@/utils/socketUtils';

interface ReceiveHandlers {
  onEnter: (payload: { userId: string }) => void;
  onExit: (payload: { userId: string }) => void;
  onPoint: (payload: { userId: string; x: number; y: number }) => void;
  onMessage: (payload: { userId: string; message: string }) => void;
  onTyping?: (payload: { userId: string }) => void;
}

interface UseChatParams {
  roomId: string;
  userId: string;
  handlers: ReceiveHandlers;
  getMyPosition: () => { x: number; y: number };
  onEnterMe?: () => void;
}

export function useChat({ roomId, userId, handlers, getMyPosition, onEnterMe }: UseChatParams) {

  // Callers pass fresh closures every render. Keep the latest ones in refs so the
  // socket subscription below only resets when the room or user changes — otherwise
  // every re-render would emit SEND_EXIT + SEND_ENTER and re-register listeners.
  const handlersRef = useRef(handlers);
  const getMyPositionRef = useRef(getMyPosition);
  const onEnterMeRef = useRef(onEnterMe);
  useEffect(() => {
    handlersRef.current = handlers;
    getMyPositionRef.current = getMyPosition;
    onEnterMeRef.current = onEnterMe;
  });

  const pointMe = () => {
    if (!socketUtils.socket) return;
    const { x, y } = getMyPositionRef.current();
    socketUtils.socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
  };

  useEffect(() => {
    const socket = socketUtils.socket;
    if (!socket) return;

    const handleEnter = (p: { userId: string }) => {
      handlersRef.current.onEnter(p);
      const { x, y } = getMyPositionRef.current();
      socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
    };
    const handleExit = (p: { userId: string }) => handlersRef.current.onExit(p);
    const handlePoint = (p: { userId: string; x: number; y: number }) => handlersRef.current.onPoint(p);
    const handleMessage = (p: { userId: string; message: string }) => handlersRef.current.onMessage(p);
    const handleTyping = (p: { userId: string }) => handlersRef.current.onTyping?.(p);

    socket.on(SocketEvent.RECEIVE_ENTER, handleEnter);
    socket.on(SocketEvent.RECEIVE_EXIT, handleExit);
    socket.on(SocketEvent.RECEIVE_POINT, handlePoint);
    socket.on(SocketEvent.RECEIVE_MESSAGE, handleMessage);
    socket.on(SocketEvent.RECEIVE_TYPING, handleTyping);

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
    sendTyping: () => {
      if (!socketUtils.socket) return;
      socketUtils.socket.emit(SocketEvent.SEND_TYPING, { roomId });
    },
    pointMe,
  };
}
