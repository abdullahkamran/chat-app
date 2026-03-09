import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { useInventory } from '@/hooks/useInventory';
import { type Item, type RoomItem } from '@chat-app/shared-types';

interface Props {
  selectedItem: Item | null;
  onSelectItem: (item: Item) => void;
  pendingItems: RoomItem[];
}

/** Bottom drawer showing the user's room-item inventory for placement. */
export function InventoryDrawer({ selectedItem, onSelectItem, pendingItems }: Props) {
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
    <View style={styles.drawer}>
      <Text style={styles.title}>Inventory</Text>

      {isLoading && <ActivityIndicator color={theme.colors.primary} />}

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
              onPress={() => !exhausted && onSelectItem(item)}
              activeOpacity={exhausted ? 1 : 0.8}
            >
              <View style={styles.imageWrapper}>
                <Image
                  source={resolveItemSource(item.assetUrl) ?? undefined}
                  style={[styles.itemImage, exhausted && styles.itemImageExhausted]}
                  contentFit="contain"
                />
                {ownedCount > 1 && (
                  <View style={[styles.countBadge, exhausted && styles.countBadgeExhausted]}>
                    <Text style={styles.countBadgeText}>{remaining}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  list: {
    gap: 10,
    paddingBottom: 4,
  },
  itemCard: {
    width: 72,
    alignItems: 'center',
    borderRadius: 8,
    padding: 6,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: theme.colors.primary,
  },
  itemCardExhausted: {
    opacity: 0.4,
  },
  itemImageExhausted: {
    opacity: 0.5,
  },
  countBadgeExhausted: {
    backgroundColor: theme.colors.textMuted,
  },
  imageWrapper: {
    position: 'relative',
  },
  itemImage: {
    width: 48,
    height: 48,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    color: theme.colors.primaryText,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  itemName: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
