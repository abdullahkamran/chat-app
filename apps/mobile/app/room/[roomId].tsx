import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Room from '../../components/Room';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  
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
