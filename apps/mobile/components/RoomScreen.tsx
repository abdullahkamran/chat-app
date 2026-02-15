import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import Room from './Room';

export default function RoomScreen(): React.JSX.Element {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  
  return (
    <View style={styles.container}>
      <Room roomId={roomId as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
