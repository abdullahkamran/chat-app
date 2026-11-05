import React from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

interface TypingIndicatorProps {
  /** Usernames of the others typing. */
  names: string[];
}

const useStyles = makeStyles(t => ({
  container: {
    paddingHorizontal: t.space.lg,
    paddingBottom: t.space.xxs,
  },
}));

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const styles = useStyles();
  if (names.length === 0) return null;

  const verb = names.length === 1 ? 'is' : 'are';

  return (
    <View style={styles.container}>
      <AppText variant="caption" color="textSecondary">
        {names.join(', ')} {verb} typing...
      </AppText>
    </View>
  );
}
