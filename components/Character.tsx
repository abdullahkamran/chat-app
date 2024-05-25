import React, { Component, useEffect } from "react";
import { Image, Animated, View } from 'react-native';
import Bubble from './Bubble';

interface CharacterProps {
  id: string;
  index: number,
  flavor?: String,
  scaleX: number,
  scaleY: number,
  posX: number,
  posY: number,
  bubbleActive?: boolean,
  bubbleMessage?: string,
  bubbleDuration?: number,
  closeBubble: Function,
}

const Character = ({
  id,
  index,
  flavor,
  scaleX,
  scaleY,
  posX,
  posY,
  bubbleActive,
  bubbleMessage,
  bubbleDuration,
  closeBubble,
} : CharacterProps) => {

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (bubbleActive) {
      timer = setTimeout(() => {
        closeBubble(id);
      }, bubbleDuration);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [bubbleActive]);

  function renderFlavor(flavor?: String) {
    switch(flavor) { 
      case 'mansoor': { 
        return require('../assets/images/mansoor.png');
      } 
      case 'kami': { 
        return require('../assets/images/kami.png');
      } 
      case 'lamba': { 
        return require('../assets/images/lamba.png');
      } 
      default: { 
        return require('../assets/images/jackSparrow.png');
      } 
   } 

  }

  return (
    <View>
      <View>
      { bubbleActive && <Bubble message={bubbleMessage}/> }
      </View>
      <Image style={{ width: 150 * scaleX, height: 150 * scaleY }} source={renderFlavor(flavor)}></Image>
    </View> 
  );
}

export default Character;