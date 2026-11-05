import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

const useStyles = makeStyles(t => ({
  root: {
    alignItems: 'center',
    paddingHorizontal: t.space.xl,
    paddingVertical: t.space.xxl,
    gap: t.space.sm,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
    marginBottom: t.space.xs,
    transform: [{ rotate: '-6deg' }],
  },
  action: {
    marginTop: t.space.md,
  },
}));

interface Props {
  icon: IconName;
  title: string;
  body?: string;
  /** A button under the text. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** What a list shows when it has nothing in it: a tilted icon tile, a line, and what to do next. */
export function EmptyState({ icon, title, body, action, style }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.root, style]}>
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={30} color={t.colors.primary} />
      </View>
      <AppText variant="heading" align="center">{title}</AppText>
      {body ? <AppText color="textSecondary" align="center">{body}</AppText> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}
