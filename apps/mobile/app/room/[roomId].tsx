import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RoomRemovalReason } from '@chat-app/shared-types';
import { SocketEvent } from '@chat-app/socket-constants';
import { showToast } from '@/components/Toast';
import { useActiveRoom } from '@/context/activeRoom.context';
import { socketUtils } from '@/utils/socketUtils';
import Room from '../../lib/room-engine/Room';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { setActiveRoomId } = useActiveRoom();
  const router = useRouter();

  // Track which room is active for smart notification suppression
  useEffect(() => {
    setActiveRoomId(roomId);
    return () => setActiveRoomId(null);
  }, [roomId, setActiveRoomId]);

  // Removed by an owner, the room deleted, or left on another device: close the room (and its member list, if open).
  useEffect(() => {
    const socket = socketUtils.socket;
    if (!socket) return;
    const onRemoved = (p: { roomId: string; reason: RoomRemovalReason }) => {
      if (p.roomId !== roomId) return;
      router.dismissTo('/(tabs)');
      // A toast, not a dialog: the room (and maybe its member list) is still closing under it.
      if (p.reason === 'removed') showToast({ text: 'An owner removed you from this room.', icon: 'exit-outline' });
      if (p.reason === 'deleted') showToast({ text: 'An owner deleted this room.', icon: 'trash-outline' });
      if (p.reason === 'unfriended') showToast({ text: "Room closed: you're no longer friends with its owner.", icon: 'heart-dislike-outline' });
    };
    socket.on(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, onRemoved);
    return () => {
      socket.off(SocketEvent.RECEIVE_REMOVED_FROM_ROOM, onRemoved);
    };
  }, [roomId, router]);

  return (
    <View style={styles.container}>
      <Room roomId={roomId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
