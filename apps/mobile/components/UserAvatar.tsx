import React from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme, type Theme } from '@/constants/theme';

/** The same accent color for a name every time. */
export function avatarColor(t: Theme, name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return t.avatarPalette[Math.abs(hash) % t.avatarPalette.length];
}

const useStyles = makeStyles(t => ({
  shape: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
  },
  letter: {
    fontFamily: t.fontFamily.display,
    color: t.colors.onPrimary,
  },
}));

interface Props {
  /** The name whose first letter is shown and whose color is used. */
  username: string;
  size?: number;
  /** A circle for people, a tilted rounded tile for rooms. */
  shape?: 'circle' | 'tile';
}

/** A colored badge with the first letter of a name, for lists of people and rooms. */
export default function UserAvatar({ username, size = 40, shape = 'circle' }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.shape,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : size * 0.32,
          backgroundColor: avatarColor(t, username),
        },
        shape === 'tile' && { transform: [{ rotate: '-4deg' }] },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.44, lineHeight: size * 0.56 }]}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
