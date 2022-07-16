import { StyleSheet } from 'react-native';

import Room from '../components/Room';
import { Text, View } from '../components/Themed';

export default function RoomScreen({ route }) {
  return (
    <View style={styles.container}>
      <Room roomId={route.params.roomId}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
