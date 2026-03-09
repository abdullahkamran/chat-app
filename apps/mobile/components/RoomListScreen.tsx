import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { io } from 'socket.io-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PaginatedRooms } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { SERVER_ORIGIN } from '../utils/config';
import { socketUtils } from '../utils/socketUtils';
import RoomListItem from './RoomListItem';
import { theme } from '@/constants/theme';

const LIMIT = 20;

export default function RoomListScreen(): React.JSX.Element {
  const { userId, selectedAvatar } = useAuth();
  const router = useRouter();
  const [showAvatarDialog, setShowAvatarDialog] = useState(!selectedAvatar);

  // Close dialog automatically once an avatar exists (e.g. after creation)
  useEffect(() => {
    if (selectedAvatar) setShowAvatarDialog(false);
  }, [selectedAvatar]);

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
    socketUtils.socket = io(SERVER_ORIGIN, { autoConnect: false });
    socketUtils.socket.auth = { id: userId };
    socketUtils.socket.connect();

    return () => {
      socketUtils.socket?.disconnect();
    };
  }, [userId]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#FFFC00" />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room._id}
          renderItem={({ item }) => (
            <RoomListItem
              name={item.name}
              subtitle={[item.category, item.description].filter(Boolean).join(' · ')}
              onPress={() => handleRoomPress(item._id)}
            />
          )}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={styles.footer} color="#FFFC00" /> : null
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/create-room')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <Modal visible={showAvatarDialog} transparent animationType="fade">
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
