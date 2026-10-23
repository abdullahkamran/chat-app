import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import UserAvatar from '@/components/UserAvatar';
import { theme } from '@/constants/theme';

interface Props {
  username: string;
  /** A second line under the name, e.g. "Level 3" or "2 mutual friends". */
  subtitle?: string;
  /** Buttons or a badge at the end of the row. */
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

/** One person in a list: avatar, name, a detail line, and whatever goes on the right. */
export default function UserRow({ username, subtitle, right, onPress, disabled }: Readonly<Props>) {
  return (
    <Pressable style={[styles.row, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled || !onPress}>
      <UserAvatar username={username} />
      <View style={styles.text}>
        <Text style={styles.username} numberOfLines={1}>{username}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  text: {
    flex: 1,
  },
  username: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
