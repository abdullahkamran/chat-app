import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/constants/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

const SIDE = 88;

const useStyles = makeStyles(t => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space.sm,
    paddingVertical: t.space.sm,
    minHeight: 56,
  },
  headerLarge: {
    paddingHorizontal: t.space.lg,
    gap: t.space.sm,
  },
  side: {
    width: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    justifyContent: 'flex-end',
  },
  title: {
    flex: 1,
  },
}));

interface Props {
  title: string;
  /** Shows a back (or close) button on the left. */
  onBack?: () => void;
  backIcon?: 'chevron-back' | 'close';
  /** Buttons on the right. */
  right?: ReactNode;
  /** Left-aligned and large, for a tab's top-level screen. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The bar at the top of a screen: back, title, actions. The caller adds the safe-area inset. */
export function ScreenHeader({ title, onBack, backIcon = 'chevron-back', right, large = false, style }: Readonly<Props>) {
  const styles = useStyles();

  if (large) {
    return (
      <View style={[styles.header, styles.headerLarge, style]}>
        <AppText variant="display" style={styles.title} numberOfLines={1}>{title}</AppText>
        {right}
      </View>
    );
  }

  return (
    <View style={[styles.header, style]}>
      <View style={styles.side}>
        {onBack && (
          <IconButton icon={backIcon} onPress={onBack} accessibilityLabel={backIcon === 'close' ? 'Close' : 'Back'} />
        )}
      </View>
      <AppText variant="heading" align="center" style={styles.title} numberOfLines={1}>{title}</AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}
