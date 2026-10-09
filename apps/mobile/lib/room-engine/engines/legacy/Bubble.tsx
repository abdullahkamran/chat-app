import { useEffect } from "react";
import { StyleSheet, Text, View } from 'react-native';

interface BubbleProps {
  message?: string;
  isTyping?: boolean;
  duration?: number;
  close?: () => void;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 20,
    minWidth: 80,
    maxWidth: 180,
    borderWidth: 2,
    borderColor: 'black',
  },
  tailOuter: {
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
  },
  tailInner: {
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
  },
  messageText: {
    backgroundColor: 'white',
    color: 'black',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  typingText: {
    backgroundColor: 'white',
    color: 'gray',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default function Bubble({ message, isTyping, duration = 3500, close }: BubbleProps) {
  useEffect(() => {
    if (!close) return;
    const timer = setTimeout(close, duration);
    return () => clearTimeout(timer);
  }, [close, duration]);

  return (
    <View style={styles.container}>
      <View style={styles.tailOuter} />
      <View style={styles.tailInner} />
      {isTyping ? (
        <Text style={styles.typingText}>...</Text>
      ) : (
        <Text style={styles.messageText}>{message}</Text>
      )}
    </View>
  );
}
