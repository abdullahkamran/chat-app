import { useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { ALL_CATEGORY, CategoryChips } from '@/components/CategoryChips';
import { AppText, Badge, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { useInventory } from '@/hooks/useInventory';
import { themeSlotsOf, type Item, type RoomTheme } from '@chat-app/shared-types';
import { Drawer } from '../components/Drawer';

interface Props {
  selectedItem: Item | null;
  /** Null when the selected card is tapped again, to go back to picking up placed items. */
  onSelectItem: (item: Item | null) => void;
  /** Item ID → copies the user can still place in this edit (the session's `available`). */
  available: Record<Item['_id'], number>;
  /** The walls and floor as they stand in edit mode, to mark the wallpaper and flooring in use. */
  theme?: RoomTheme;
}

const useStyles = makeStyles(t => ({
  list: {
    gap: t.space.sm + 2,
    paddingTop: t.space.xs,
    paddingBottom: t.space.xs,
  },
  itemCard: {
    width: 76,
    alignItems: 'center',
    borderRadius: t.radius.md,
    padding: 6,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
  },
  itemCardSelected: {
    borderColor: t.colors.secondary,
    backgroundColor: t.colors.secondarySoft,
  },
  itemCardExhausted: {
    opacity: 0.4,
  },
  itemImageExhausted: {
    opacity: 0.5,
  },
  imageWrapper: {
    position: 'relative',
  },
  itemImage: {
    width: 48,
    height: 48,
  },
  itemName: {
    marginTop: t.space.xs,
  },
  categories: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: t.space.sm,
  },
  empty: {
    paddingVertical: t.space.lg,
  },
}));

/** Bottom drawer showing the user's room-item inventory for placement. */
export function InventoryDrawer({ selectedItem, onSelectItem, available, theme }: Props) {
  const t = useTheme();
  const styles = useStyles();
  // Everything the user owns, placed copies included, so an item all in rooms still shows (at 0).
  const { data: groupedItems = [], isLoading } = useInventory();

  // Only the categories the user owns something in, so no tab is ever empty.
  const categories = [...new Set(groupedItems.map(e => e.item.category))].sort();
  const [chosenCategory, setCategory] = useState(ALL_CATEGORY);
  const category = categories.includes(chosenCategory) ? chosenCategory : ALL_CATEGORY;
  const shown = category === ALL_CATEGORY ? groupedItems : groupedItems.filter(e => e.item.category === category);
  const themeIds = new Set([theme?.floor?._id, theme?.leftWall?._id, theme?.rightWall?._id]);

  return (
    <Drawer title="Inventory">
      {categories.length > 1 && (
        <CategoryChips categories={categories} selected={category} onSelect={setCategory} contentStyle={styles.categories} />
      )}

      {isLoading && <Spinner color="secondary" />}
      {!isLoading && shown.length === 0 && (
        <AppText variant="caption" color="textMuted" align="center" style={styles.empty}>
          Nothing here yet. Get items in the shop.
        </AppText>
      )}

      <FlatList
        data={shown}
        keyExtractor={({ item }) => item._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: { item } }) => {
          // Wallpapers and floorings go on the walls or floor, not in a cell: never used up,
          // and marked while they're on the room.
          const isThemeItem = themeSlotsOf(item).length > 0;
          const remaining = available[item._id] ?? 0;
          const exhausted = !isThemeItem && remaining <= 0;
          const isSelected = isThemeItem ? themeIds.has(item._id) : selectedItem?._id === item._id;
          return (
            <TouchableOpacity
              style={[styles.itemCard, isSelected && styles.itemCardSelected, exhausted && styles.itemCardExhausted]}
              onPress={() => {
                if (isThemeItem) onSelectItem(item);
                else if (isSelected) onSelectItem(null);
                else if (!exhausted) onSelectItem(item);
              }}
              activeOpacity={exhausted && !isSelected ? 1 : 0.8}
            >
              <View style={styles.imageWrapper}>
                <Image
                  source={resolveItemSource(item.assetUrl) ?? undefined}
                  style={[styles.itemImage, exhausted && styles.itemImageExhausted]}
                  contentFit="contain"
                />
                {!isThemeItem && (
                  <Badge
                    count={Math.max(remaining, 0)}
                    showZero
                    tone={exhausted ? 'muted' : 'primary'}
                    ringColor={t.colors.surfaceElevated}
                  />
                )}
              </View>
              <AppText variant="caption" color="textSecondary" align="center" style={styles.itemName} numberOfLines={1}>
                {item.name}
              </AppText>
            </TouchableOpacity>
          );
        }}
      />
    </Drawer>
  );
}
