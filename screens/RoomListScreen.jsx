import { RootTabScreenProps } from '../types';

import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import RoomListItem from '../components/RoomListItem';
import { io } from "socket.io-client";
import { socket } from '../utils/socketUtils';

const styles = StyleSheet.create({
  container: {
   flex: 1,
   paddingTop: 22
  },
});

const USER_ID = '62c6f420fccaa7c05d7d87f1';
const SERVER_ORIGIN = 'http://192.168.18.182:1017';

export default function RoomListScreen({ navigation }) {

  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    const response = await fetch(`${SERVER_ORIGIN}/api/v1/users/${USER_ID}/rooms`);
    const data = await response.json();
    setRooms(data);
  };

  const connectSocket = async () => {
    socket = io(SERVER_ORIGIN, { autoConnect: false });
    socket.auth = { id: USER_ID };
    
    socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    socket.on("connect", () => {
      console.log("SOCKET CONNECTED");
    });
    
    socket.on("disconnect", () => {
      console.log("SOCKET DISCONNECTED");
    });

    socket.connect();
  };

  useEffect(() => {
    fetchRooms();
    connectSocket();
  }, [])

  function goToRoom(room) {
    navigation.navigate('RoomScreen');
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(room) => room._id}
        renderItem={({room}) =>
          <RoomListItem
            name={room.name}
            onPress={() => goToRoom(room)}>
          </RoomListItem>}
      />
    </View>
  );
}
