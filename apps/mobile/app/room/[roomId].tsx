import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useActiveRoom } from '@/context/activeRoom.context';
import Room from '../../lib/room-engine/Room';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { setActiveRoomId } = useActiveRoom();

  // Track which room is active for smart notification suppression
  useEffect(() => {
    setActiveRoomId(roomId);
    return () => setActiveRoomId(null);
  }, [roomId, setActiveRoomId]);

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
