import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import Constants from 'expo-constants';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';

import { CharacterDirection, type RoomCharacter, type User } from '@chat-app/shared-types';
import { useUserInfo } from '@/context/user.context';
import { useChat } from '@/hooks/useChat';
import { useRoomDetails } from '@/hooks/useRoomDetails';
import Character from './Character';
import { RoomBackdrop } from './RoomBackdrop';
import { TypingIndicator } from './TypingIndicator';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  chatInput: {
    flex: 1,
    zIndex: 1001,
    backgroundColor: 'grey',
    borderRadius: 25,
    color: 'white',
    fontSize: 18,
    padding: 10,
  },
  sendButton: {
    borderRadius: 24,
    backgroundColor: 'white',
    height: 48,
    width: 48,
  }
});

export function Room({ roomId }: Readonly<{ roomId: string }>) {

  const { data: roomDetails, isLoading: isRoomLoading, error: roomError } = useRoomDetails(roomId);
  const [roomCharacters, setRoomCharacters] = useState<Record<User['_id'], RoomCharacter>>({});

  const [message, setMessage] = useState('');
  const { user } = useUserInfo();
  const userId = user?.userId ?? '';

  const [inputHeight, setInputHeight] = useState(42);

  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sendTypingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

  const { moveMe, sendMessage, sendTyping } = useChat({
    roomId,
    userId,
    handlers: {
      onEnter: receiveEnter,
      onExit: receiveExit,
      onPoint: receivePoint,
      onMessage: receiveMessage,
      onTyping: receiveTyping,
    },
    getMyPosition: () => {
      const character = roomCharacters[userId ?? ''];
      return character ? { x: character.position.x, y: character.position.y } : { x: 0, y: 0 };
    },
    onEnterMe: () => enterCharacter(userId ?? ''),
  });

  function receiveEnter({ userId }: { userId: string }) {
    enterCharacter(userId);
  }

  function receiveExit({ userId }: { userId: string }) {
    exitCharacter(userId);
  }

  function receivePoint({ userId, x, y }: { userId: string; x: number; y: number }) {
    enterCharacter(userId);
    moveCharacter(userId, x, y);
  }

  function receiveMessage({ userId, message }: { userId: string; message: string }) {
    enterCharacter(userId);
    pushChatMessage(userId, message);
  }

  function receiveTyping({ userId }: { userId: string }) {
    enterCharacter(userId);
    setTypingUserIds(prev => new Set(prev).add(userId));
    clearTimeout(typingTimeoutRef.current[userId]);
    typingTimeoutRef.current[userId] = setTimeout(() => {
      setTypingUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }, 2000);
  }

  const handleMessageChange = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(sendTypingTimeoutRef.current);
    sendTypingTimeoutRef.current = setTimeout(() => sendTyping(), 300);
  }, [sendTyping]);


  function enterCharacter(userId: string) {
    if (roomCharacters[userId]) return;
    setRoomCharacters(current => {
      return {
        ...current,
        [userId]: {
          user: { _id: userId } as User,
          position: { x: 0, y: 0, z: 0 },
          direction: CharacterDirection.RIGHT,
          messages: [],
          isTyping: false,
        }
      };
    });
  }

  function exitCharacter(userId: string) {
    setRoomCharacters(current => {
      const { [userId]: _, ...rest } = current;
      return rest;
    });
  }

  function moveCharacter(userId: string, x: number, y: number) {
    const character = roomCharacters[userId];
    character.position = { x, y, z: 0 };
  }

  function pushChatMessage(userId: string, message: string) {
    const character = roomCharacters[userId];
    character.messages.push(message);
  }

  function moveMeWithCharacter(x: number, y: number) {
    moveMe(x, y);
    if (user) moveCharacter(user.userId, x, y);
  }

  function bubbleMe(message: string) {
    sendMessage(message);
    pushChatMessage(userId, message);
    if (message === 'Halo') {
      setTimeout(() => {
        moveCharacter('lamba', 300, 300);
        pushChatMessage('lamba', 'AYYYYY WADDUP BITCHEZ XD');
      }, 1000);
    }
  }

  function handleRoomPress(e: { nativeEvent: { locationX: number; locationY: number } }) {
    const { locationX, locationY } = e.nativeEvent;
    moveMeWithCharacter(locationX, locationY);
  }

  function onMessageSubmit() {
    bubbleMe(message);
    setMessage('');
    Keyboard.dismiss();
  }

  if (isRoomLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (roomError || !roomDetails) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View>
          <Button title="Failed to load room." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ReactNativeZoomableView
        maxZoom={1.5}
        minZoom={0.5}
        zoomStep={0.5}
        initialZoom={1}
        bindToBorders={true}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            flex: 1,
          }}
          onPress={(e) => handleRoomPress(e)}
        >
          <RoomBackdrop
            roomDetails={roomDetails}
          />
          

          {Object.values(roomCharacters).map((character: RoomCharacter) => (
            <Character
              key={character.user._id}
              {...character}
            />
          ))}


        </TouchableOpacity>
      </ReactNativeZoomableView>
      <TypingIndicator typingUserIds={typingUserIds} />
      <View style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-end', padding: 4 }}>
        <TextInput
          style={{...styles.chatInput, height: inputHeight}}
          multiline
          placeholder="Type a message..."
          value={message} onChangeText={handleMessageChange}
          onContentSizeChange={e => setInputHeight(e.nativeEvent.contentSize.height)} />
          <Button buttonStyle={styles.sendButton} icon={<Ionicons name="send" size={24} color="black" />}
            onPress={onMessageSubmit}/>
      </View>
    </SafeAreaView>
  );
}

export default Room;
