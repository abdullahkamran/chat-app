import { useQuery } from '@tanstack/react-query';

import type { RoomDetails } from '@chat-app/shared-types';
import { myFetch } from '@/utils/fetch';

const fetchRoomDetails = async (roomId: string): Promise<RoomDetails> => {
  const response = await myFetch(`/api/v1/rooms/${roomId}/details`);

  if (!response.ok) {
    throw new Error('Failed to fetch room details');
  }

  return response.json();
};

export const useRoomDetails = (roomId?: string) =>
  useQuery({
    queryKey: ['roomDetails', roomId],
    queryFn: () => fetchRoomDetails(roomId as string),
    enabled: !!roomId,
  });
