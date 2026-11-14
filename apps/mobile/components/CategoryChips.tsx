import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { Chip, Skeleton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

/** The "All" entry, listed before the categories. */
export const ALL_CATEGORY = '__all__';

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  /** Padding around the row; defaults to the screen gutter. */
  contentStyle?: StyleProp<ViewStyle>;
  /** The categories are still loading: show placeholders after "All". */
  loading?: boolean;
  /** How a category reads on its chip; defaults to the category itself. */
  labelOf?: (category: string) => string;
}

/** Chip widths while categories load, so the row doesn't look uniform. */
const SKELETON_WIDTHS = [76, 92, 64, 84];

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
export function CategoryChips({ categories, selected, onSelect, contentStyle, loading = false, labelOf }: Readonly<Props>) {
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
          label={cat === ALL_CATEGORY ? 'All' : labelOf?.(cat) ?? cat}
          selected={selected === cat}
          onPress={() => onSelect(cat)}
        />
      ))}
      {loading && categories.length === 0 &&
        SKELETON_WIDTHS.map((w, i) => <Skeleton key={i} width={w} height={34} radius="pill" />)}
    </ScrollView>
  );
}
