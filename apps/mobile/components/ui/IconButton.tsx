import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme, type Theme } from '@/constants/theme';
import { Badge } from './Badge';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = 'plain' | 'surface' | 'primary' | 'secondary';

export interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  /**
   * `plain`: just the icon. `surface`: on a round tile. `primary` and `secondary`:
   * filled floating buttons that sit on a drop.
   */
  variant?: Variant;
  /** Diameter in px. */
  size?: number;
  /** Highlights the button, e.g. while the drawer it opens is open. */
  active?: boolean;
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Fill, drop and icon color of the filled variants. */
function filled(t: Theme, variant: Variant) {
  if (variant === 'primary') return { bg: t.colors.primary, drop: t.colors.primaryDeep, fg: t.colors.onPrimary };
  if (variant === 'secondary') return { bg: t.colors.secondary, drop: t.colors.secondaryDeep, fg: t.colors.onSecondary };
  return null;
}

const useStyles = makeStyles(t => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
  },
  surface: {
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.border,
  },
  active: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primary,
  },
}));

/** A round, icon-only button. Always give it an accessibilityLabel. */
export function IconButton({
  icon, onPress, accessibilityLabel, variant = 'plain', size = 40, active = false, badge = 0, disabled, style,
}: Readonly<IconButtonProps>) {
  const t = useTheme();
  const styles = useStyles();
  const fill = filled(t, variant);
  const color = fill ? fill.fg : active ? t.colors.primary : t.colors.text;
  const iconSize = Math.round(size * (fill ? 0.46 : 0.55));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size < 40 ? 8 : 4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        variant === 'surface' && styles.surface,
        fill && { backgroundColor: fill.bg },
        fill && !pressed && !disabled && { boxShadow: `0px ${t.pressDepth}px 0px 0px ${fill.drop}` },
        fill && pressed && { transform: [{ translateY: t.pressDepth }] },
        !fill && active && styles.active,
        !fill && pressed && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
      <Badge count={badge} tone={fill ? 'error' : 'primary'} />
    </Pressable>
  );
}
