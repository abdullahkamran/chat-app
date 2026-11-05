import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const useStyles = makeStyles(t => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    height: 34,
    paddingHorizontal: t.space.md + 2,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  selected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  label: {
    ...t.type.label,
    color: t.colors.textSecondary,
    textTransform: 'capitalize',
  },
  labelSelected: {
    color: t.colors.onPrimary,
  },
}));

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** An icon after the label, e.g. `close` on a removable chip. */
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** A small pill for filters and picked items. */
export function Chip({ label, selected = false, onPress, trailingIcon, style }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && { opacity: 0.75 }, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>{label}</Text>
      {trailingIcon && (
        <Ionicons name={trailingIcon} size={14} color={selected ? t.colors.onPrimary : t.colors.textSecondary} />
      )}
    </Pressable>
  );
}
