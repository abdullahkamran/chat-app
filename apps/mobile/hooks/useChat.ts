import { useEffect } from 'react';

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

  const pointMe = () => {
    if (!socketUtils.socket) return;
    const { x, y } = getMyPosition();
    socketUtils.socket.emit(SocketEvent.SEND_POINT, { roomId, x, y });
  };

  useEffect(() => {
    if (!socketUtils.socket) return;
    const { onEnter, onExit, onPoint, onMessage, onTyping } = handlers;
    const handleEnter = (p: { userId: string }) => {
      onEnter(p);
      pointMe();
    };
    socketUtils.socket.on(SocketEvent.RECEIVE_ENTER, handleEnter);
    socketUtils.socket.on(SocketEvent.RECEIVE_EXIT, onExit);
    socketUtils.socket.on(SocketEvent.RECEIVE_POINT, onPoint);
    socketUtils.socket.on(SocketEvent.RECEIVE_MESSAGE, onMessage);
    if (onTyping) {
      socketUtils.socket.on(SocketEvent.RECEIVE_TYPING, onTyping);
    }

    if (userId) {
      socketUtils.socket.emit(SocketEvent.SEND_ENTER, { roomId });
      onEnterMe?.();
    }

    return () => {
      socketUtils.socket?.emit(SocketEvent.SEND_EXIT, { roomId });
      socketUtils.socket?.off(SocketEvent.RECEIVE_ENTER, handleEnter);
      socketUtils.socket?.off(SocketEvent.RECEIVE_EXIT, onExit);
      socketUtils.socket?.off(SocketEvent.RECEIVE_POINT, onPoint);
      socketUtils.socket?.off(SocketEvent.RECEIVE_MESSAGE, onMessage);
      if (onTyping) {
        socketUtils.socket?.off(SocketEvent.RECEIVE_TYPING, onTyping);
      }
    };
  }, [roomId, userId, handlers.onEnter, handlers.onExit, handlers.onPoint, handlers.onMessage, handlers.onTyping, getMyPosition, onEnterMe]);

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
