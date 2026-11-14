import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import type { Avatar } from '@chat-app/shared-types';

export const userAvatarKey = (userId: string) => ['user-avatar', userId];

/**
 * A user's selected avatar, for drawing their head in lists (`UserAvatar`). Your own comes
 * straight from auth, so it changes the moment you wear another one; anyone else's is
 * fetched once and kept for a few minutes. `avatar` is null when they have none or the
 * fetch failed: show the letter badge then.
 */
export function useUserAvatar(userId: string | null | undefined): { avatar: Avatar | null; isLoading: boolean } {
  const { userId: me, selectedAvatar } = useAuth();
  const mine = !!userId && userId === me;
  const query = useQuery({
    queryKey: userAvatarKey(userId ?? ''),
    queryFn: () => api.get<Avatar>(`/api/v1/users/${userId}/avatar`),
    enabled: !!userId && !mine,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  if (mine) return { avatar: selectedAvatar, isLoading: false };
  return { avatar: query.data ?? null, isLoading: query.isLoading };
}
