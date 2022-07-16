import React, { Component } from "react";
import { StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Animated, GestureResponderEvent, TextInput, NativeSyntheticEvent, TextInputSubmitEditingEventData } from 'react-native';
import ZoomableImage from './ZoomableImage';
import Character from './Character';
import Bubble from './Bubble';
import Constants from 'expo-constants';
import ReactNativeZoomableView from '@dudigital/react-native-zoomable-view/src/ReactNativeZoomableView';
import { Text, View } from '../components/Themed';
import CommentInput from "./CommentInput";

import { socketUtils } from "../utils/socketUtils";

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

const devCharacters = [
  {index: 0, posX: 0, posY: 0, speed: 500, animation: new Animated.ValueXY({x: 0, y: 0}), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500},
  {index: 1, flavor: 'kami', posX: 200, posY: 1000, speed: 500, animation: new Animated.ValueXY({x: 200, y: 1000}), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500},
  {index: 2, flavor: 'mansoor', posX: 500, posY: 200, speed: 500, animation: new Animated.ValueXY({x: 300, y: 0}), scaleX: 1, scaleY: 1, bubbleActive: false, bubbleDuration: 3500},
  {index: 3, flavor: 'lamba', posX: 100, posY: 200, speed: 2000, animation: new Animated.ValueXY({x: -300, y: -300}), scaleX: 1, scaleY: 2, bubbleActive: false, bubbleDuration: 7000},
];

export class Room extends Component {

  constructor(props) {
    super(props);
    this.state = {
      characters: devCharacters,
      me: devCharacters[0],
      moveAnimation: new Animated.Value(0),
      message: '',
    };
  }

  componentDidMount() {
    socketUtils.socket.on("receive_message", ({ roomId, userId, message }) => {
      receiveMessage({ roomId, userId, message });
    });
  }

  receiveMessage({ roomId, userId, message }) {
    this.moveCharacter(this.state.characters[3], 300, 300);
    this.bubbleCharacter(this.state.characters[3], message);
  }

  renderCharacters(characters) {
    return characters.map(character =>     <Animated.View key={character.index} style={[character.animation?.getLayout(), {position: 'absolute', zIndex: 1000}]}>
    <Character {...character} closeBubble={this.closeBubble.bind(this)}/></Animated.View>);
  }

  moveCharacter(character, x, y) {
    Animated.timing(character.animation, {
      toValue: {x, y},
      duration: character.speed,
      useNativeDriver: false, // TODO: try to make it true
    }).start();
    // character.posX = x;
    // character.posY = y;
    // this.setState({characters: this.state.characters});
  }

  moveMe(x, y) {
    this.moveCharacter(this.state.me, x, y);
  }

  moveFellow() {

  }

  bubbleCharacter(character, message) {
    character.bubbleActive = true;
    character.bubbleMessage = message;
  }

  bubbleMe(message) {
    this.bubbleCharacter(this.state.me, message);
    if (message === 'Halo') {
      setTimeout(() => {
        this.moveCharacter(this.state.characters[3], 300, 300);
        this.bubbleCharacter(this.state.characters[3], 'AYYYYY WADDUP BITCHEZ XD');
      }, 1000);

    }
  }

  bubbleFellow() {

  }

  closeBubble(index) {
    const character = this.state.characters[index];
    console.log(this.state.characters);
    console.log(index);

    character.bubbleActive = false;
    this.setState({characters: this.state.characters});
  }

  sendMessage(message) {
    socketUtils.socket.emit('send_message', {
      message: message,
      roomId: this.props.roomId,
    });
    this.bubbleMe(message);
  }

  handleRoomPress(e) {
    const { locationX, locationY } = e.nativeEvent;
    this.moveMe(locationX, locationY);
  }

  onMessageSubmit(e) {
    this.sendMessage(e.nativeEvent.text);
    this.setState({
      message: '',
    });
  }

  onMessageChange(newText) {
    this.setState({
      message: newText,
    });
  }


  render() {

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
          <TouchableOpacity    activeOpacity={1}        style={{
            flex: 1
          }}          onPress={(e) => this.handleRoomPress(e)}>


          <Image
          style={{
            flex: 1
          }}
          source={require('../assets/images/home.png')}
        />
          {this.renderCharacters(this.state.characters)}
          </TouchableOpacity>
        </ReactNativeZoomableView>
        <TextInput
          style={styles.chatInput}
          returnKeyLabel="send"
          placeholder="Type a message..."
          value={this.state.message} onChangeText={(text) => this.onMessageChange(text)}
          onSubmitEditing={(e) => this.onMessageSubmit(e)}/>
        </SafeAreaView>
    );
  }

}

export default Room;