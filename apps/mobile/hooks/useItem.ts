import { useQuery } from '@tanstack/react-query';

import type { Item } from '@chat-app/shared-types';
import { api } from '@/lib/api';

const fetchItem = (itemId: string): Promise<Item> =>
  api.get<Item>(`/api/v1/items/${itemId}`);

export const useItem = (itemId?: string) =>
  useQuery({
    queryKey: ['item', itemId],
    queryFn: () => fetchItem(itemId as string),
    enabled: !!itemId,
  });
