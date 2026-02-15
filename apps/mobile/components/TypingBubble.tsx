import React from 'react';
import { Text, View } from 'react-native';

export function TypingBubble() {
  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 20,
        minWidth: 60,
        borderWidth: 2,
        borderColor: 'black',
      }}
    >
      <View
        style={{
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
        }}
      />
      <View
        style={{
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
        }}
      />
      <Text style={{ backgroundColor: 'white', color: 'gray', fontSize: 16, textAlign: 'center' }}>
        ...
      </Text>
    </View>
  );
}
