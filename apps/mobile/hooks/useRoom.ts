import { useQuery } from '@tanstack/react-query';

import type { Room } from '@chat-app/shared-types';
import { myFetch } from '@/utils/fetch';

const fetchRoom = async (roomId: string): Promise<Room> => {
  const response = await myFetch(`/api/v1/rooms/${roomId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch room');
  }

  const data = await response.json();

  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  } as Room;
};

export const useRoom = (roomId?: string) =>
  useQuery({
    queryKey: ['room', roomId],
    queryFn: () => fetchRoom(roomId as string),
    enabled: !!roomId,
  });


