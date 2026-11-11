import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedRooms, Room, RoomCategory } from '@chat-app/shared-types';
import { Button, Dialog, EmptyState, IconButton, ScreenHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/context/auth.context';
import { useIncomingRequests } from '@/hooks/useFriends';
import { api } from '@/lib/api';
import { makeStyles } from '@/constants/theme';
import { SERVER_ORIGIN } from '../utils/config';
import { listenForAccountEvents, socketUtils } from '../utils/socketUtils';
import RoomListItem from './RoomListItem';

const LIMIT = 20;

/** "Your room" for the user's own personal room, "Friend's room" for a friend's. Group rooms: nothing. */
function roomKindLabel(room: Room, userId: string | null): string {
  if (room.category !== RoomCategory.PERSONAL) return '';
  return room.ownerId === userId ? 'Your room' : "Friend's room";
}

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  loader: {
    flex: 1,
  },
  list: {
    paddingTop: t.space.sm,
    // Clear of the floating button.
    paddingBottom: 112,
    gap: t.space.md,
  },
  footer: {
    paddingVertical: t.space.lg,
  },
  fab: {
    position: 'absolute',
    bottom: t.space.xl,
    right: t.space.xl,
  },
  dialogActions: {
    gap: t.space.xs,
  },
}));

export default function RoomListScreen(): React.JSX.Element {
  const styles = useStyles();
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
      <ScreenHeader
        large
        title="Rooms"
        right={
          <IconButton
            icon="person-add-outline"
            variant="surface"
            badge={requestCount}
            onPress={() => router.push('/add-friends')}
            accessibilityLabel="Add friends"
          />
        }
      />
      {isLoading ? (
        <Spinner style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room._id}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={
            <EmptyState
              icon="planet-outline"
              title="No rooms yet"
              body="Start one and invite your friends over."
            />
          }
          ListFooterComponent={isFetchingNextPage ? <Spinner style={styles.footer} /> : undefined}
        />
      )}

      <IconButton
        icon="add"
        variant="primary"
        size={60}
        style={styles.fab}
        onPress={() => router.push('/create-room')}
        accessibilityLabel="New room"
      />

      <Dialog
        visible={showAvatarDialog && !selectedAvatar}
        onClose={() => setShowAvatarDialog(false)}
        icon="happy"
        title="Set up your avatar"
        message="You need an avatar before joining conversations."
        actions={
          <View style={styles.dialogActions}>
            <Button
              title="Create Avatar"
              fullWidth
              onPress={() => { setShowAvatarDialog(false); router.push('/(avatar)/create'); }}
            />
            <Button title="Maybe Later" variant="ghost" fullWidth onPress={() => setShowAvatarDialog(false)} />
          </View>
        }
      />
    </View>
  );
}
