import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme, type Theme, type ThemeColors } from '@/constants/theme';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'reward' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container's width. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Each variant's fill, edge, the drop under it, and its label color. */
function variantColors(t: Theme): Record<ButtonVariant, { bg: string; border: string; drop: string | null; fg: keyof ThemeColors }> {
  const c = t.colors;
  return {
    primary: { bg: c.primary, border: c.primary, drop: c.primaryDeep, fg: 'onPrimary' },
    reward: { bg: c.reward, border: c.reward, drop: c.rewardDeep, fg: 'onReward' },
    secondary: { bg: c.surfaceElevated, border: c.borderStrong, drop: c.outline, fg: 'text' },
    danger: { bg: c.errorSoft, border: c.error, drop: null, fg: 'error' },
    ghost: { bg: 'transparent', border: 'transparent', drop: null, fg: 'primary' },
  };
}

const useStyles = makeStyles(t => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.sm,
    borderWidth: t.borderWidth.thick,
    borderRadius: t.radius.pill,
  },
  sm: { height: t.controlHeight.sm, paddingHorizontal: t.space.md },
  md: { height: t.controlHeight.md, paddingHorizontal: t.space.lg },
  lg: { height: t.controlHeight.lg, paddingHorizontal: t.space.xl },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.4 },
}));

/**
 * The app's button: a chunky pill that sits on a hard drop and sinks into it when pressed.
 * `primary` for the main action on a screen, `secondary` beside it, `reward` for buying,
 * `danger` for destructive actions, `ghost` for low-key links.
 */
export function Button({
  title, onPress, variant = 'primary', size = 'md', icon, loading = false, disabled = false, fullWidth = false,
  style, accessibilityLabel,
}: Readonly<ButtonProps>) {
  const t = useTheme();
  const styles = useStyles();
  const v = variantColors(t)[variant];
  const fg = t.colors[v.fg];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => {
        const sunk = pressed && v.drop !== null;
        return [
          styles.base,
          styles[size],
          { backgroundColor: v.bg, borderColor: v.border },
          v.drop && !sunk && { boxShadow: `0px ${t.pressDepth}px 0px 0px ${v.drop}` },
          sunk && { transform: [{ translateY: t.pressDepth }] },
          pressed && !v.drop && { opacity: 0.7 },
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      {loading ? (
        <Spinner color={v.fg} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
          <Text style={[size === 'sm' ? t.type.buttonSmall : t.type.button, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
