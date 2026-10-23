import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { RoomMail, RoomMailbox } from '@chat-app/shared-types';
import { api } from '@/lib/api';

export const mailboxKey = (roomId: string) => ['mailbox', roomId];

/** A room's postbox as this user sees it: the mail, how much is unread, and whether they may post. */
export function useMailbox(roomId: string | undefined) {
  return useQuery({
    queryKey: mailboxKey(roomId ?? ''),
    queryFn: () => api.get<RoomMailbox>(`/api/v1/rooms/${roomId}/mail`),
    enabled: !!roomId,
  });
}

/** Leave, delete, and mark the postbox read. Each refetches it. */
export function useMailboxMutations(roomId: string) {
  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: mailboxKey(roomId) });
  const onError = (e: Error) => Alert.alert('Something went wrong', e.message);
  return {
    post: useMutation({
      mutationFn: (text: string) => api.post<RoomMail>(`/api/v1/rooms/${roomId}/mail`, { text }),
      onSuccess: refetch,
      onError,
    }),
    remove: useMutation({
      mutationFn: (mailId: string) => api.delete(`/api/v1/rooms/${roomId}/mail/${mailId}`),
      onSuccess: refetch,
      onError,
    }),
    // Clears the badge at once; the refetch confirms it.
    markRead: useMutation({
      mutationFn: () => api.post(`/api/v1/rooms/${roomId}/mail/read`, {}),
      onMutate: () => {
        queryClient.setQueryData<RoomMailbox>(mailboxKey(roomId), (box) => (box ? { ...box, unread: 0 } : box));
      },
      onSettled: refetch,
    }),
  };
}
