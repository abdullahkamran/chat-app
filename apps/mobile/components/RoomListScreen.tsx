import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedRooms, Room, RoomCategory } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { useIncomingRequests } from '@/hooks/useFriends';
import { api } from '@/lib/api';
import { SERVER_ORIGIN } from '../utils/config';
import { listenForAccountEvents, socketUtils } from '../utils/socketUtils';
import RoomListItem from './RoomListItem';
import { theme } from '@/constants/theme';

const LIMIT = 20;

/** "Your room" for the user's own personal room, "Friend's room" for a friend's. Group rooms: nothing. */
function roomKindLabel(room: Room, userId: string | null): string {
  if (room.category !== RoomCategory.PERSONAL) return '';
  return room.ownerId === userId ? 'Your room' : "Friend's room";
}

export default function RoomListScreen(): React.JSX.Element {
  const { userId, selectedAvatar } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [showAvatarDialog, setShowAvatarDialog] = useState(!selectedAvatar);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['rooms'],
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedRooms>(`/api/v1/rooms?page=${pageParam}&limit=${LIMIT}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!userId,
  });

  const rooms = data?.pages.flatMap((p) => p.rooms) ?? [];
  const requestCount = useIncomingRequests().data?.length ?? 0;

  function handleRoomPress(roomId: string) {
    if (!selectedAvatar) {
      setShowAvatarDialog(true);
      return;
    }
    router.push({ pathname: '/room/[roomId]', params: { roomId } });
  }

  useEffect(() => {
    if (!userId) return;

    if (socketUtils.socket) {
      socketUtils.socket.disconnect();
    }
    const socket = io(SERVER_ORIGIN, { autoConnect: false });
    socketUtils.socket = socket;
    socket.auth = { id: userId };
    const stopListening = listenForAccountEvents(socket, queryClient);
    socket.connect();

    return () => {
      stopListening();
      socket.disconnect();
    };
  }, [userId, queryClient]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rooms</Text>
        <Pressable onPress={() => router.push('/add-friends')} hitSlop={8} accessibilityLabel="Add friends">
          <Ionicons name="person-add-outline" size={24} color={theme.colors.text} />
          {requestCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requestCount > 9 ? '9+' : requestCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#FFFC00" />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room._id}
          renderItem={({ item }) => (
            <RoomListItem
              name={item.name}
              subtitle={[roomKindLabel(item, userId), item.description].filter(Boolean).join(' · ')}
              isPersonal={item.category === RoomCategory.PERSONAL}
              onPress={() => handleRoomPress(item._id)}
            />
          )}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} /> : undefined
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/create-room')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <Modal visible={showAvatarDialog && !selectedAvatar} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Set up your avatar</Text>
            <Text style={styles.dialogBody}>
              You need an avatar before joining conversations.
            </Text>
            <Pressable
              style={styles.dialogButton}
              onPress={() => { setShowAvatarDialog(false); router.push('/(avatar)/create'); }}
            >
              <Text style={styles.dialogButtonText}>Create Avatar</Text>
            </Pressable>
            <Pressable
              style={styles.dialogCancelButton}
              onPress={() => setShowAvatarDialog(false)}
            >
              <Text style={styles.dialogCancelText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.primaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    color: theme.colors.primaryText,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  dialogTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  dialogBody: {
    color: theme.colors.placeholder,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  dialogButton: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  dialogButtonText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 16,
  },
  dialogCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 32,
  },
  dialogCancelText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
});
