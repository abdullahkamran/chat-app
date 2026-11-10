import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { Chip } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

/** The "All" entry, listed before the categories. */
export const ALL_CATEGORY = '__all__';

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  /** Padding around the row; defaults to the screen gutter. */
  contentStyle?: StyleProp<ViewStyle>;
}

const useStyles = makeStyles(t => ({
  bar: { flexGrow: 0, flexShrink: 0 },
  content: {
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    gap: t.space.sm,
    flexDirection: 'row',
  },
}));

/** A horizontal row of category filters, "All" first. */
export function CategoryChips({ categories, selected, onSelect, contentStyle }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {[ALL_CATEGORY, ...categories].map(cat => (
        <Chip
          key={cat}
          label={cat === ALL_CATEGORY ? 'All' : cat}
          selected={selected === cat}
          onPress={() => onSelect(cat)}
        />
      ))}
    </ScrollView>
  );
}
