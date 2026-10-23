import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { RoomRemovalReason } from '@chat-app/shared-types';
import { SocketEvent } from '@chat-app/socket-constants';
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

  // Removed by the owner, or left on another device: close the room (and its member list, if open).
  useEffect(() => {
    const socket = socketUtils.socket;
    if (!socket) return;
    const onRemoved = (p: { roomId: string; reason: RoomRemovalReason }) => {
      if (p.roomId !== roomId) return;
      router.dismissTo('/(tabs)');
      if (p.reason === 'removed') Alert.alert('Removed from room', 'The owner removed you from this room.');
      if (p.reason === 'unfriended') Alert.alert('Room closed', "You're no longer friends with this room's owner.");
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
