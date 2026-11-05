import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';

const useStyles = makeStyles(t => ({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: t.radius.pill,
    paddingHorizontal: 5,
    borderWidth: t.borderWidth.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...t.type.caption,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    lineHeight: 13,
  },
}));

interface Props {
  count: number;
  /** Shown as `max+` above this. */
  max?: number;
  tone?: 'primary' | 'error' | 'muted';
  /** Show the badge at zero too, e.g. for copies left. */
  showZero?: boolean;
  /** The color behind the badge, for the ring that separates it from what it sits on. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** A count pinned to the top-right corner of its parent. Renders nothing at zero unless `showZero`. */
export function Badge({ count, max = 99, tone = 'primary', showZero = false, ringColor, style }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  if (count < 0 || (count === 0 && !showZero)) return null;
  const bg = tone === 'primary' ? t.colors.primary : tone === 'error' ? t.colors.error : t.colors.textMuted;
  const fg = tone === 'primary' ? t.colors.onPrimary : tone === 'error' ? t.colors.onError : t.colors.background;
  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderColor: ringColor ?? t.colors.background }, style]}
      pointerEvents="none"
    >
      <Text style={[styles.text, { color: fg }]}>{count > max ? `${max}+` : count}</Text>
    </View>
  );
}
