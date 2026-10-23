import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

/** The same accent color for a name every time. */
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return theme.avatarPalette[Math.abs(hash) % theme.avatarPalette.length];
}

/** A colored circle with the first letter of a username, for lists of people. */
export default function UserAvatar({ username, size = 40 }: Readonly<{ username: string; size?: number }>) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(username) },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{username.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: theme.colors.primaryText,
    fontWeight: '700',
  },
});
