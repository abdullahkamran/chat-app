import { useQuery } from '@tanstack/react-query';

import type { Item } from '@chat-app/shared-types';
import { myFetch } from '@/utils/fetch';

const fetchItem = async (itemId: string): Promise<Item> => {
  const response = await myFetch(`/api/v1/items/${itemId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch item');
  }

  const data = await response.json();

  return data as Item;
};

export const useItem = (itemId?: string) =>
  useQuery({
    queryKey: ['item', itemId],
    queryFn: () => fetchItem(itemId as string),
    enabled: !!itemId,
  });
