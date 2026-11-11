import { useQuery } from '@tanstack/react-query';
import { type InventoryEntry } from '@chat-app/shared-types';
import { api } from '@/lib/api';

/**
 * The room items the user owns, by name: copies free to place (`count`) and copies standing in
 * rooms (`placed`). Placing a copy, buying one, or someone taking ours out of a room changes it,
 * so refetch ['inventory'] after those.
 */
export const useInventory = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryEntry[]>('/api/v1/inventory'),
    enabled,
  });

/** Item ID → copies owned in all, free and placed: what the shop shows. */
export function ownedCounts(entries: InventoryEntry[]): Record<string, { owned: number; placed: number }> {
  return Object.fromEntries(entries.map(e => [e.item._id, { owned: e.count + e.placed, placed: e.placed }]));
}
