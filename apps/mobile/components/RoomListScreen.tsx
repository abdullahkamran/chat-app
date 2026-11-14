import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedRooms, Room, RoomCategory, type RoomListEntry } from '@chat-app/shared-types';
import { Button, Dialog, EmptyState, ErrorState, IconButton, ScreenHeader, SkeletonGroup, Spinner } from '@/components/ui';
import { useAuth } from '@/context/auth.context';
import { useIncomingRequests } from '@/hooks/useFriends';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { api } from '@/lib/api';
import { makeStyles } from '@/constants/theme';
import { SERVER_ORIGIN } from '../utils/config';
import { listenForAccountEvents, socketUtils } from '../utils/socketUtils';
import RoomListItem, { RoomListItemSkeleton, type RoomFace } from './RoomListItem';

const LIMIT = 20;

/** "Your room" for the user's own personal room, "Friend's room" for a friend's. Group rooms: nothing. */
function roomKindLabel(room: Room, userId: string | null): string {
  if (room.category !== RoomCategory.PERSONAL) return '';
  return room.ownerId === userId ? 'Your room' : "Friend's room";
}

/** A friend's personal room shows only its label, without the owner's "Welcome to my room!" tagline. */
function roomSubtitle(room: RoomListEntry, userId: string | null): string {
  const isFriendsRoom = room.category === RoomCategory.PERSONAL && room.ownerId !== userId;
  const first = room.category === RoomCategory.PERSONAL ? roomKindLabel(room, userId) : peopleLine(room, userId);
  return [first, isFriendsRoom ? '' : room.description].filter(Boolean).join(' · ');
}

/** Names shown in a group room's subtitle before "and N others". */
const NAMES_SHOWN = 2;

/** Who is in a group room, you included: "ana, you and 3 others". */
function peopleLine(room: RoomListEntry, userId: string | null): string {
  const shown = room.people.slice(0, NAMES_SHOWN);
  if (shown.length === 0 || (room.memberCount <= 1 && shown[0]._id === userId)) return 'Just you';
  const names = shown.map((p, i) => (p._id !== userId ? p.username : i === 0 ? 'You' : 'you'));
  // Everyone but the people named.
  const others = Math.max(0, room.memberCount - names.length);
  if (others === 0) return names.join(' and ');
  return `${names.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/**
 * Whose heads make a room's badge. A personal room shows its owner. A group room shows its
 * latest chatters, you among them when you're one of them.
 */
function roomFaces(room: RoomListEntry, userId: string | null): RoomFace[] {
  if (room.category === RoomCategory.PERSONAL) return [{ userId: room.ownerId, username: room.name }];
  if (room.people.length > 0) return room.people.map(p => ({ userId: p._id, username: p.username }));
  return userId ? [{ userId, username: room.name }] : [];
}

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  skeletons: {
    paddingTop: t.space.sm,
    gap: t.space.md,
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
    isError,
    isRefetching,
    refetch,
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
  const refreshControl = usePullToRefresh(refetch);
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
        <SkeletonGroup style={styles.skeletons} label="Loading rooms">
          {Array.from({ length: 6 }, (_, i) => <RoomListItemSkeleton key={i} />)}
        </SkeletonGroup>
      ) : isError && !data ? (
        <ErrorState title="Couldn't load your rooms" onRetry={refetch} retrying={isRefetching} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room._id}
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <RoomListItem
              name={item.name}
              faces={roomFaces(item, userId)}
              subtitle={roomSubtitle(item, userId)}
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
