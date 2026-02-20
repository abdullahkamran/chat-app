import { createContext, useContext } from 'react';

interface ActiveRoomContextType {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
}

export const ActiveRoomContext = createContext<ActiveRoomContextType>({
  activeRoomId: null,
  setActiveRoomId: () => {},
});

export const useActiveRoom = () => useContext(ActiveRoomContext);
