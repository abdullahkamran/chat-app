import React, { Component, useEffect, useState } from "react";
import { Image, Animated, View } from 'react-native';
import Bubble from './Bubble';

let BUBBLE_KEY = 0;

interface BubbleProps {
  key?: string;
  message: string;
  duration: number;
}

interface CharacterProps {
  id: string;
  index: number,
  flavor?: String,
  scaleX: number,
  scaleY: number,
  posX: number,
  posY: number,
  bubble?: BubbleProps,
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
  bubble,
  bubbleDuration,
} : CharacterProps) => {

  const [bubbles, setBubbles] = useState<Array<BubbleProps>>([]);

  useEffect(() => {
    if (bubble?.message) {
      setBubbles(current => ([...current, { ...bubble, key: `${BUBBLE_KEY}`}]));
      BUBBLE_KEY += 1;
    }
  }, [bubble]);

  function closeBubble() {
    setBubbles(current => current.toSpliced(0, 1));
  }

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
    <View style={{ position: 'relative' }}>
      <View style={{ position: 'absolute', bottom: 160, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', left: 0 }}>
        {bubbles.map((bubble) =>
          <Bubble key={bubble.key} message={bubble.message} duration={bubbleDuration} close={() => closeBubble()} />
        )}
      </View>
      <Image style={{ width: 150 * scaleX, height: 150 * scaleY }} source={renderFlavor(flavor)}></Image>
    </View> 
  );
}

export default Character;