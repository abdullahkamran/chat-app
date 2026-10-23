import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { FriendSuggestion, IncomingFriendRequest, PublicUser } from '@chat-app/shared-types';
import { api } from '@/lib/api';

export const FRIENDS_KEY = ['friends'];
export const FRIEND_REQUESTS_KEY = ['friendRequests'];
export const SUGGESTIONS_KEY = ['friendSuggestions'];

/** Refetch everything that shows friend state: lists, requests, Quick Add, and search results' buttons. */
export function refetchFriendData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
  queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_KEY });
  queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
  queryClient.invalidateQueries({ queryKey: ['userSearch'] });
}

/** Quick Add: people from contacts, friends of friends, and people in your rooms. */
export function useSuggestions() {
  return useQuery({
    queryKey: SUGGESTIONS_KEY,
    queryFn: () => api.get<FriendSuggestion[]>('/api/v1/friends/suggestions'),
  });
}

/** The signed-in user's friends, by username. */
export function useFriends() {
  return useQuery({
    queryKey: FRIENDS_KEY,
    queryFn: () => api.get<PublicUser[]>('/api/v1/friends'),
  });
}

/** Requests other people sent the signed-in user, newest first. */
export function useIncomingRequests() {
  return useQuery({
    queryKey: FRIEND_REQUESTS_KEY,
    queryFn: () => api.get<IncomingFriendRequest[]>('/api/v1/friends/requests'),
  });
}

/**
 * Send, accept, decline or cancel, unfriend, and dismiss from Quick Add. Each hook call has its own mutations,
 * so a row that calls this shows only its own pending state.
 */
export function useFriendActions() {
  const queryClient = useQueryClient();
  const options = {
    onSuccess: () => refetchFriendData(queryClient),
    onError: (e: Error) => Alert.alert('Something went wrong', e.message),
  };
  return {
    send: useMutation({ mutationFn: (userId: string) => api.post('/api/v1/friends/requests', { userId }), ...options }),
    accept: useMutation({ mutationFn: (userId: string) => api.post(`/api/v1/friends/requests/${userId}/accept`, {}), ...options }),
    /** Decline a request they sent, or cancel one you sent. */
    removeRequest: useMutation({ mutationFn: (userId: string) => api.delete(`/api/v1/friends/requests/${userId}`), ...options }),
    unfriend: useMutation({ mutationFn: (userId: string) => api.delete(`/api/v1/friends/${userId}`), ...options }),
    /** Hide someone from Quick Add for good. */
    dismiss: useMutation({
      mutationFn: (userId: string) => api.post(`/api/v1/friends/suggestions/${userId}/dismiss`, {}),
      ...options,
    }),
  };
}
