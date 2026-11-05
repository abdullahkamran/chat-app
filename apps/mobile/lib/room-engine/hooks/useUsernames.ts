import { useQueries } from '@tanstack/react-query';

import type { PublicUser, User } from '@chat-app/shared-types';
import { api } from '@/lib/api';

/** Usernames by user id, fetched once per user. Missing until loaded. */
export function useUsernames(userIds: User['_id'][]): Record<User['_id'], string> {
  const ids = [...new Set(userIds)];
  return useQueries({
    queries: ids.map(id => ({
      queryKey: ['publicUser', id],
      queryFn: () => api.get<PublicUser>(`/api/v1/users/${id}`),
      staleTime: Infinity,
    })),
    combine: results => {
      const names: Record<User['_id'], string> = {};
      results.forEach((r, i) => {
        if (r.data) names[ids[i]] = r.data.username;
      });
      return names;
    },
  });
}
