import { useEffect } from "react";
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface BubbleProps {
  message?: string;
  isTyping?: boolean;
  duration?: number;
  /** When the message was sent (`Date.now()`); the bubble closes `duration` after that, not after it appears. */
  sentAt?: number;
  close?: () => void;
  /** Draw the pointer toward the speaker; only the bubble nearest the head has one. */
  tail?: boolean;
}

const TAIL = 6;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  body: {
    backgroundColor: theme.colors.bubble,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: 160,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL,
    borderRightWidth: TAIL,
    borderTopWidth: TAIL,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.bubble,
  },
  messageText: {
    color: theme.colors.bubbleText,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  typingText: {
    color: theme.colors.bubbleTyping,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
});

export default function Bubble({ message, isTyping, duration = 3500, sentAt, close, tail = false }: BubbleProps) {
  useEffect(() => {
    if (!close) return;
    const left = sentAt === undefined ? duration : sentAt + duration - Date.now();
    const timer = setTimeout(close, Math.max(0, left));
    return () => clearTimeout(timer);
  }, [close, duration, sentAt]);

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        {isTyping ? (
          <Text style={styles.typingText}>...</Text>
        ) : (
          <Text style={styles.messageText}>{message}</Text>
        )}
      </View>
      {tail && <View style={styles.tail} />}
    </View>
  );
}
