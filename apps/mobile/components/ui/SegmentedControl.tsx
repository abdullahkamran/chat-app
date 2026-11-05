import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/constants/theme';

const useStyles = makeStyles(t => ({
  track: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.border,
    padding: t.space.xs,
    gap: t.space.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: t.radius.pill,
  },
  segmentActive: {
    backgroundColor: t.colors.primary,
    boxShadow: `0px 2px 0px 0px ${t.colors.primaryDeep}`,
  },
  label: {
    ...t.type.buttonSmall,
    color: t.colors.textSecondary,
  },
  labelActive: {
    color: t.colors.onPrimary,
  },
}));

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** A row of mutually exclusive tabs on a pill track, e.g. Items / Outfits / Animations. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: Readonly<Props<T>>) {
  const styles = useStyles();
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
