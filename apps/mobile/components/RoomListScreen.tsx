import { Link } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, View } from 'react-native';
import { io } from "socket.io-client";
import { SERVER_ORIGIN, USER_ID1, USER_ID2 } from '../utils/config';
import RoomListItem from './RoomListItem';

import { UserContext } from '../context/user.context';
import { myFetch } from '../utils/fetch';
import { socketUtils } from "../utils/socketUtils";

interface Room {
  _id: string;
  name: string;
}

interface ReceiveMessageParams {
  roomId: string;
  userId: string;
  message: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 22
  },
});

export default function RoomListScreen(): React.JSX.Element {

  const { user, setUser } = useContext(UserContext);
  const { userId } = user ?? {};
  const [rooms, setRooms] = useState<Room[]>([]);

  const fetchRooms = async (): Promise<void> => {
    const response = await myFetch(`/api/v1/users/${userId}/rooms`);
    const data = await response.json();
    setRooms(data);
  };

  const connectSocket = async (): Promise<void> => {
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

    socketUtils.socket.on("receive_message", ({ roomId, userId, message }: ReceiveMessageParams) => {
      receiveMessage({ roomId, userId, message });
    });

    socketUtils.socket.connect();
  };

  function receiveMessage({ roomId, userId, message }: ReceiveMessageParams): void {
    console.log(message);
  }

  useEffect(() => {
    if (userId) {
      connectSocket();
      fetchRooms();
    }
  }, [userId]);

  const switchUser = (userId: string): void => {
    console.log('switching to user', userId);
    setUser({ userId });
    connectSocket();
    fetchRooms();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(room) => room._id}
        renderItem={({ item }) =>
          <Link href={{ pathname: '/room/[roomId]', params: { roomId: item._id } }} asChild>
            <RoomListItem
              name={item.name}
            />
          </Link>}
      />
      <Button title='User1' onPress={() => switchUser(USER_ID1)}></Button>
      <Button title='User2' onPress={() => switchUser(USER_ID2)}></Button>
    </View>
  );
}
