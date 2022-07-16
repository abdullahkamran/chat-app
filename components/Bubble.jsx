import React from "react";
import { Image, Animated, Text } from 'react-native';

const Bubble = (props = {
  message: '',
  shape: 'plain',
  textStyle: 'plain',
  duration: 3500,
}) => {
    return (
        <Text style={{backgroundColor: 'white', color: 'black'}}>{props.message}</Text>
    );
}

export default Bubble;