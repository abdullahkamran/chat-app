import { useQuery } from '@tanstack/react-query';

import type { User } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';

/** The signed-in user's own profile, private fields included. */
export function useMe() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get<User>('/api/v1/users/me'),
    enabled: !!userId,
  });
}
