import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface TypingIndicatorProps {
  /** Usernames of the others typing. */
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const verb = names.length === 1 ? 'is' : 'are';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {names.join(', ')} {verb} typing...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  text: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
