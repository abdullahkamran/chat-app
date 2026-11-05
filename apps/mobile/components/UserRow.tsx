import React, { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import UserAvatar from '@/components/UserAvatar';
import { AppText } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

interface Props {
  username: string;
  /** A second line under the name, e.g. "Level 3" or "2 mutual friends". */
  subtitle?: string;
  /** Buttons or a badge at the end of the row. */
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

const useStyles = makeStyles(t => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  text: {
    flex: 1,
    gap: 1,
  },
}));

/** One person in a list: avatar, name, a detail line, and whatever goes on the right. */
export default function UserRow({ username, subtitle, right, onPress, disabled }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <Pressable style={[styles.row, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled || !onPress}>
      <UserAvatar username={username} size={44} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>{username}</AppText>
        {subtitle ? <AppText variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {right}
    </Pressable>
  );
}
