import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Avatar } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { announceAvatarChanged } from '@/utils/socketUtils';

export const MY_AVATARS_KEY = ['avatars'];

export interface MyAvatars {
  avatars: Avatar[];
  selectedAvatar: string | null;
}

/** The logged-in user's saved avatars. */
export const useMyAvatars = () =>
  useQuery({
    queryKey: MY_AVATARS_KEY,
    queryFn: () => api.get<MyAvatars>('/api/v1/avatar'),
  });

/**
 * Make one of the user's avatars their selected one: saves it as the default,
 * updates auth and tells the rooms the user stands in to refetch it.
 */
export function useWearAvatar() {
  const queryClient = useQueryClient();
  const { setSelectedAvatar } = useAuth();

  return useMutation({
    mutationFn: (avatar: Avatar) => api.put<void>(`/api/v1/avatar/${avatar._id}/set-default`, {}),
    onSuccess: (_, avatar) => {
      setSelectedAvatar(avatar);
      announceAvatarChanged();
      queryClient.invalidateQueries({ queryKey: MY_AVATARS_KEY });
    },
  });
}
