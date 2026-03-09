import { useQuery } from '@tanstack/react-query';

import type { RoomDetails } from '@chat-app/shared-types';
import { api } from '@/lib/api';

const fetchRoomDetails = (roomId: string): Promise<RoomDetails> =>
  api.get<RoomDetails>(`/api/v1/rooms/${roomId}/details`);

export const useRoomDetails = (roomId?: string) =>
  useQuery({
    queryKey: ['roomDetails', roomId],
    queryFn: () => fetchRoomDetails(roomId as string),
    enabled: !!roomId,
  });
