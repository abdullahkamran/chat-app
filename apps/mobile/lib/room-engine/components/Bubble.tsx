import { useEffect } from "react";
import { Text, View } from 'react-native';

import { makeStyles } from '@/constants/theme';

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
/** The bubble's outline, like the ink edge of a comic speech bubble. */
const EDGE = 2;

const useStyles = makeStyles(t => ({
  container: {
    alignItems: 'center',
  },
  body: {
    backgroundColor: t.colors.bubble,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: t.radius.md,
    borderWidth: EDGE,
    borderColor: t.colors.outline,
    maxWidth: 160,
  },
  // An outline-colored triangle with a bubble-colored one inside it, overlapping the
  // bubble's bottom edge so the two read as one shape.
  tail: {
    marginTop: -EDGE,
    width: 2 * (TAIL + EDGE),
    height: TAIL + EDGE,
  },
  tailOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL + EDGE,
    borderRightWidth: TAIL + EDGE,
    borderTopWidth: TAIL + EDGE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: t.colors.outline,
  },
  tailInner: {
    position: 'absolute',
    top: 0,
    left: EDGE,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL,
    borderRightWidth: TAIL,
    borderTopWidth: TAIL,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: t.colors.bubble,
  },
  messageText: {
    fontFamily: t.fontFamily.bodyBold,
    color: t.colors.bubbleText,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  typingText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    color: t.colors.bubbleTyping,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1,
    textAlign: 'center',
  },
}));

export default function Bubble({ message, isTyping, duration = 3500, sentAt, close, tail = false }: BubbleProps) {
  const styles = useStyles();

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
      {tail && (
        <View style={styles.tail}>
          <View style={styles.tailOuter} />
          <View style={styles.tailInner} />
        </View>
      )}
    </View>
  );
}
