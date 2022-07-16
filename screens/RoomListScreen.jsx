import { RootTabScreenProps } from '../types';

import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import RoomListItem from '../components/RoomListItem';
import { io } from "socket.io-client";
import { SERVER_ORIGIN, USER_ID } from '../utils/config';

import { socketUtils } from "../utils/socketUtils";

const styles = StyleSheet.create({
  container: {
   flex: 1,
   paddingTop: 22
  },
});

export default function RoomListScreen({ navigation }) {

  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    const response = await fetch(`${SERVER_ORIGIN}/api/v1/users/${USER_ID}/rooms`);
    const data = await response.json();
    setRooms(data);
  };

  const connectSocket = async () => {
    socketUtils.socket = io(SERVER_ORIGIN, { autoConnect: false });
    socketUtils.socket.auth = { id: USER_ID };
    
    socketUtils.socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    socketUtils.socket.on("connect", () => {
      console.log("SOCKET CONNECTED");
    });
    
    socketUtils.socket.on("disconnect", () => {
      console.log("SOCKET DISCONNECTED");
    });

    socketUtils.socket.connect();
  };

  useEffect(() => {
    fetchRooms();
    connectSocket();
  }, [])

  function goToRoom(room) {
    navigation.navigate('RoomScreen', { roomId: room._id });
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(room) => room._id}
        renderItem={({ item }) =>
          <RoomListItem
            name={item.name}
            onPress={() => goToRoom(item)}>
          </RoomListItem>}
      />
    </View>
  );
}
