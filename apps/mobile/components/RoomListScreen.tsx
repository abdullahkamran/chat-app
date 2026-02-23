import { Link, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { io } from 'socket.io-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PaginatedRooms } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { SERVER_ORIGIN } from '../utils/config';
import { socketUtils } from '../utils/socketUtils';
import RoomListItem from './RoomListItem';

const LIMIT = 20;

export default function RoomListScreen(): React.JSX.Element {
  const { userId, selectedAvatar } = useAuth();
  const router = useRouter();

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
            <Link href={{ pathname: '/room/[roomId]', params: { roomId: item._id } }} asChild>
              <RoomListItem
                name={item.name}
                subtitle={[item.category, item.description].filter(Boolean).join(' · ')}
              />
            </Link>
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

      <Modal visible={!selectedAvatar} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Setup your avatar</Text>
            <Text style={styles.dialogBody}>
              You need an avatar before joining conversations.
            </Text>
            <Pressable
              style={styles.dialogButton}
              onPress={() => router.push('/(avatar)/create')}
            >
              <Text style={styles.dialogButtonText}>Create Avatar</Text>
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
    backgroundColor: '#000',
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
    backgroundColor: '#FFFC00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    color: '#000',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  dialogTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  dialogBody: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  dialogButton: {
    marginTop: 8,
    backgroundColor: '#FFFC00',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  dialogButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
