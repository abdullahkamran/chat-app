import React, { useEffect } from "react";
import { View, Text } from 'react-native';

interface BubbleProps {
  message?: string,
  shape?: string,
  textStyle?: string,
  duration?: number,
  close: () => void,
}

const Bubble = (props: BubbleProps = {
  message: '',
  shape: 'plain',
  textStyle: 'plain',
  duration: 3500,
  close: () => { },
}) => {

  useEffect(() => {
    let timer = setTimeout(() => {
      props.close();
    }, props.duration);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={{
      position: 'relative',
      backgroundColor: 'white',
      padding: 16,
      borderRadius: 20,
      minWidth: 80,
      maxWidth: 180,
      borderWidth: 2,
      borderColor: 'black',
    }}>
      <View style={{
        position: 'absolute',
        bottom: -40,
        left: '50%',
        height: 0,
        width: 0,
        borderStyle: 'solid',
        borderLeftWidth: 12,
        borderLeftColor: 'transparent',
        borderRightWidth: 12,
        borderRightColor: 'transparent',
        borderTopWidth: 22,
        borderTopColor: 'black',
        borderBottomWidth: 22,
        borderBottomColor: 'transparent',
      }}>
      </View>
      <View style={{
          position: 'absolute',
          bottom: -40,
          left: '50%',
          height: 0,
          width: 0,
          borderStyle: 'solid',
          borderLeftWidth: 10,
          borderLeftColor: 'transparent',
          borderRightWidth: 10,
          borderRightColor: 'transparent',
          borderTopWidth: 20,
          borderTopColor: 'white',
          borderBottomWidth: 20,
          borderBottomColor: 'transparent',
        }}></View>
      <Text style={{ backgroundColor: 'white', color: 'black', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
        {props.message}
      </Text>
    </View>
  );
}

export default Bubble;