import React from "react";
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

const RoomListItem = ({
  name,
  onPress,
}) => {

  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={styles.item}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
   flex: 1,
   paddingTop: 22
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
    color: 'white',
    borderWidth: 1,
    borderBottomColor: 'white',
  },
});

export default RoomListItem;
