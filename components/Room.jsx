import React, { Component, useContext, useEffect, useState } from "react";
import { StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Animated, GestureResponderEvent, TextInput, NativeSyntheticEvent, TextInputSubmitEditingEventData } from 'react-native';
import Character from './Character';
import Constants from 'expo-constants';
import ReactNativeZoomableView from '@dudigital/react-native-zoomable-view/src/ReactNativeZoomableView';

import { socketUtils } from "../utils/socketUtils";
import { USER_ID1, USER_ID2 } from "../utils/config";
import { UserContext } from "../context/user.context";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  chatInput: {
    zIndex: 1001,
    borderWidth: 1,
    borderColor: 'blue',
    color: 'white',
    fontSize: 16,
    padding: 10,
    height: 50,
  },
});

const devCharacters = {
  [USER_ID1]: { id: USER_ID1, posX: 0, posY: 0, speed: 500, animation: new Animated.ValueXY({ x: 0, y: 0 }), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500, active: false },
  [USER_ID2]: { id: USER_ID2, flavor: 'kami', posX: 200, posY: 1000, speed: 500, animation: new Animated.ValueXY({ x: 200, y: 1000 }), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500, active: false },
  'mansoor': { id: 'mansoor', flavor: 'mansoor', posX: 500, posY: 200, speed: 500, animation: new Animated.ValueXY({ x: 300, y: 0 }), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500, active: true },
  'lamba': { id: 'lamba', flavor: 'lamba', posX: 100, posY: 200, speed: 2000, animation: new Animated.ValueXY({ x: -300, y: -300 }), scaleX: 1, scaleY: 2, bubbleActive: false, bubbleDuration: 7000, active: true },
};

function Characters({ characters, closeBubble }) {
  return Object.values(characters).filter(({ active }) => active).map(character => <Animated.View key={character.id} style={[character.animation?.getLayout(), { position: 'absolute', zIndex: 1000 }]}>
    <Character {...character} closeBubble={closeBubble} /></Animated.View>);
}

export function Room({ roomId }) {

  const [characters, setCharacters] = useState(devCharacters);
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);

  useEffect(() => {
    setupSockets();
    enterMe();

    return () => {
      exitMe();
      cleanupSockets();
    };
  }, []);

  function setupSockets() {
    socketUtils.socket.on("receive_enter", receiveEnter);
    socketUtils.socket.on("receive_exit", receiveExit);
    socketUtils.socket.on("receive_point", receivePoint);
    socketUtils.socket.on("receive_message", receiveMessage);
  }

  function cleanupSockets() {
    socketUtils.socket.off("receive_enter", receiveEnter);
    socketUtils.socket.off("receive_exit", receiveExit);
    socketUtils.socket.off("receive_point", receivePoint);
    socketUtils.socket.off("receive_message", receiveMessage);
  }

  // RECEIVE FUNCTIONS

  function receiveEnter({ userId }) {
    enterCharacter(userId);
    pointMe();
  }

  function receiveExit({ userId }) {
    exitCharacter(userId);
  }

  function receivePoint({ userId, x, y }) {
    moveCharacter(userId, x, y);
  }

  function receiveMessage({ userId, message }) {
    bubbleCharacter(userId, message);
  }

  // RECEIVE FUNCTIONS END

  // CHARACTER FUNCTIONS

  function enterCharacter(userId) {
    console.log('enterCharacter', userId);
    const character = characters[userId];
    character.active = true;
    renderCharacters();
  }

  function exitCharacter(userId) {
    console.log('exitCharacter', userId);
    const character = characters[userId];
    character.active = false;
    renderCharacters();
  }

  function moveCharacter(userId, x, y) {
    const character = characters[userId];
    character.active = true;
    Animated.timing(character.animation, {
      toValue: { x, y },
      duration: character.speed,
      useNativeDriver: false, // TODO: try to make it true
    }).start();
    renderCharacters();
  }

  function bubbleCharacter(userId, message) {
    const character = characters[userId];
    character.active = true;
    character.bubbleActive = true;
    character.bubbleMessage = message;
    renderCharacters();
  }

  // CHARACTER FUNCTIONS END

  // ME FUNCTIONS
  
  function enterMe() {
    socketUtils.socket.emit('send_enter', {
      roomId,
    });
    enterCharacter(user.userId);
  }

  function exitMe() {
    socketUtils.socket.emit('send_exit', {
      roomId,
    });
    exitCharacter(user.userId);
  }

  function pointMe() {
    const character = characters[user.userId];
    socketUtils.socket.emit('send_point', {
      roomId,
      x: character.animation.x,
      y: character.animation.y,
    });
  }

  function moveMe(x, y) {
    socketUtils.socket.emit('send_point', {
      roomId,
      x,
      y,
    });
    moveCharacter(user.userId, x, y);
  }

  function bubbleMe(message) {
    socketUtils.socket.emit('send_message', {
      message: message,
      roomId,
    });
    bubbleCharacter(user.userId, message);
    if (message === 'Halo') {
      setTimeout(() => {
        moveCharacter('lamba', 300, 300);
        bubbleCharacter('lamba', 'AYYYYY WADDUP BITCHEZ XD');
      }, 1000);
    }
  }

  // ME FUNCTIONS END

  function closeBubble(userId) {
    console.log('closeBubble', userId);
    const character = characters[userId];
    character.bubbleActive = false;
    renderCharacters();
  }

  function handleRoomPress(e) {
    const { locationX, locationY } = e.nativeEvent;
    moveMe(locationX, locationY);
  }

  function onMessageSubmit(e) {
    bubbleMe(e.nativeEvent.text);
    setMessage('');
  }

  function renderCharacters() {
    setCharacters(currentCharacters => ({ ...currentCharacters }));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ReactNativeZoomableView
        maxZoom={1.5}
        minZoom={0.5}
        zoomStep={0.5}
        initialZoom={1}
        bindToBorders={true}
        captureEvent={true}
      >
        <TouchableOpacity activeOpacity={1} style={{
          flex: 1
        }} onPress={(e) => handleRoomPress(e)}>


          <Image
            style={{
              flex: 1
            }}
            source={require('../assets/images/home.png')}
          />
          <Characters characters={characters} closeBubble={closeBubble} />
        </TouchableOpacity>
      </ReactNativeZoomableView>
      <TextInput
        style={styles.chatInput}
        returnKeyLabel="send"
        placeholder="Type a message..."
        value={message} onChangeText={(text) => setMessage(text)}
        onSubmitEditing={(e) => onMessageSubmit(e)} />
    </SafeAreaView>
  );
}

export default Room;