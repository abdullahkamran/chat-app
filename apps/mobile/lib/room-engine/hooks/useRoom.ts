import { useQuery } from '@tanstack/react-query';

import type { Room } from '@chat-app/shared-types';
import { api } from '@/lib/api';

const fetchRoom = (roomId: string): Promise<Room> =>
  api.get<Room>(`/api/v1/rooms/${roomId}`);

export const useRoom = (roomId?: string) =>
  useQuery({
    queryKey: ['room', roomId],
    queryFn: () => fetchRoom(roomId as string),
    enabled: !!roomId,
  });
