import { useQuery } from '@tanstack/react-query';
import { type Item } from '@chat-app/shared-types';
import { api } from '@/lib/api';

export const useInventory = () =>
  useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<Item[]>('/api/v1/inventory'),
  });
