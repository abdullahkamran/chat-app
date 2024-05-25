import { RootTabScreenProps } from '../types';

import React, { useContext, useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, View } from 'react-native';
import RoomListItem from '../components/RoomListItem';
import { io } from "socket.io-client";
import { SERVER_ORIGIN, USER_ID1, USER_ID2 } from '../utils/config';

import { socketUtils } from "../utils/socketUtils";
import { myFetch } from '../utils/fetch';
import { UserContext } from '../context/user.context';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 22
  },
});

export default function RoomListScreen({ navigation }) {

  const { user, setUser } = useContext(UserContext);
  const { userId } = user;
  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    const response = await myFetch(`/api/v1/users/${userId}/rooms`);
    const data = await response.json();
    setRooms(data);
  };

  const connectSocket = async () => {
    if (socketUtils.socket) {
      socketUtils.socket.disconnect();
    }
    socketUtils.socket = io(SERVER_ORIGIN, { autoConnect: false });
    socketUtils.socket.auth = { id: userId };

    socketUtils.socket.on("connect", () => {
      console.log("SOCKET CONNECTED");
    });

    socketUtils.socket.on("disconnect", () => {
      console.log("SOCKET DISCONNECTED");
    });

    socketUtils.socket.on("receive_message", ({ roomId, userId, message }) => {
      receiveMessage({ roomId, userId, message });
    });

    socketUtils.socket.connect();
  };

  function receiveMessage({ roomId, userId, message }) {
    console.log(message);
  }

  useEffect(() => {
    console.log('changed');
    connectSocket();
    fetchRooms();
  }, [userId])

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
      <Button title='User1' onPress={() => setUser({ userId: USER_ID1 })}></Button>
      <Button title='User2' onPress={() => setUser({ userId: USER_ID2 })}></Button>
    </View>
  );
}
