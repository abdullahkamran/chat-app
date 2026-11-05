import { Image } from 'expo-image';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { AppText, Badge, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { useInventory } from '@/hooks/useInventory';
import { type Item, type RoomItem } from '@chat-app/shared-types';
import { Drawer } from '../components/Drawer';

interface Props {
  selectedItem: Item | null;
  /** Null when the selected card is tapped again, to go back to picking up placed items. */
  onSelectItem: (item: Item | null) => void;
  pendingItems: RoomItem[];
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
}));

/** Bottom drawer showing the user's room-item inventory for placement. */
export function InventoryDrawer({ selectedItem, onSelectItem, pendingItems }: Props) {
  const t = useTheme();
  const styles = useStyles();
  const { data: rawItems, isLoading } = useInventory();

  const groupedItems = (rawItems ?? []).reduce<Array<{ item: Item; ownedCount: number }>>((acc, item) => {
    const existing = acc.find((e) => e.item._id === item._id);
    if (existing) {
      existing.ownedCount++;
    } else {
      acc.push({ item, ownedCount: 1 });
    }
    return acc;
  }, []);

  return (
    <Drawer title="Inventory">
      {isLoading && <Spinner color="secondary" />}

      <FlatList
        data={groupedItems}
        keyExtractor={({ item }) => item._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: { item, ownedCount } }) => {
          const placedCount = pendingItems.filter(ri => ri.itemId._id === item._id).length;
          const remaining = ownedCount - placedCount;
          const exhausted = remaining <= 0;
          const isSelected = selectedItem?._id === item._id;
          return (
            <TouchableOpacity
              style={[styles.itemCard, isSelected && styles.itemCardSelected, exhausted && styles.itemCardExhausted]}
              onPress={() => {
                if (isSelected) onSelectItem(null);
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
                {ownedCount > 1 && (
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
