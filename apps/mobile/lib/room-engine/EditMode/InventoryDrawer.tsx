import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ALL_CATEGORY, CategoryChips } from '@/components/CategoryChips';
import { AppText, Badge, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { useInventory } from '@/hooks/useInventory';
import { themeSlotsOf, type Item, type RoomTheme } from '@chat-app/shared-types';
import type { EditLink, EditDrag } from '../core/contract';
import { Drawer } from '../components/Drawer';

/** How long a card is held before it lifts out of the drawer. */
const HOLD_MS = 250;
/** Pixels a card is pushed up before it comes out of the drawer; sideways scrolls the list. */
const SWIPE_OUT = 12;

interface Props {
  selectedItem: Item | null;
  /** Null when the selected card is tapped again, to go back to picking up placed items. */
  onSelectItem: (item: Item | null) => void;
  /** Item ID → copies the user can still place in this edit (the session's `available`). */
  available: Record<Item['_id'], number>;
  /** The walls and floor as they stand in edit mode, to mark the wallpaper and flooring in use. */
  theme?: RoomTheme;
  /** The finger, written while a card is dragged out (see EditLink). */
  editLink: EditLink;
  /** A card came out of the drawer: start dragging a copy of its item. */
  onDragStart: (item: Item) => void;
  /** The finger dragging a card lifted. */
  onDrop: () => void;
  /** The drag under way, if any: a placed item can be dropped here to put it away. */
  drag: EditDrag | null;
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

/**
 * Bottom drawer showing the user's room-item inventory. Tap a card to choose it for
 * tap-to-place; hold it, or push it up, to drag a copy into the room. While a placed item
 * is dragged, the drawer is where it can be put away.
 */
export function InventoryDrawer({
  selectedItem, onSelectItem, available, theme, editLink, onDragStart, onDrop, drag,
}: Props) {
  const styles = useStyles();
  // Everything the user owns, placed copies included, so an item all in rooms still shows (at 0).
  const { data: groupedItems = [], isLoading } = useInventory();

  // Only the categories the user owns something in, so no tab is ever empty.
  const categories = [...new Set(groupedItems.map(e => e.item.category))].sort();
  const [chosenCategory, setCategory] = useState(ALL_CATEGORY);
  const category = categories.includes(chosenCategory) ? chosenCategory : ALL_CATEGORY;
  const shown = category === ALL_CATEGORY ? groupedItems : groupedItems.filter(e => e.item.category === category);
  const themeIds = new Set([theme?.floor?._id, theme?.leftWall?._id, theme?.rightWall?._id]);

  const puttingAway = drag?.source === 'placed';
  const dropTarget = puttingAway ? (drag.over === 'away' ? 'over' : 'ready') : null;

  return (
    <Drawer title={puttingAway ? 'Drop here to put it away' : 'Inventory'} dropTarget={dropTarget}>
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
          return (
            <InventoryCard
              item={item}
              isThemeItem={isThemeItem}
              remaining={available[item._id] ?? 0}
              isSelected={isThemeItem ? themeIds.has(item._id) : selectedItem?._id === item._id}
              onSelectItem={onSelectItem}
              editLink={editLink}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          );
        }}
      />
    </Drawer>
  );
}

interface CardProps {
  item: Item;
  isThemeItem: boolean;
  remaining: number;
  isSelected: boolean;
  onSelectItem: (item: Item | null) => void;
  editLink: EditLink;
  onDragStart: (item: Item) => void;
  onDrop: () => void;
}

function InventoryCard({
  item, isThemeItem, remaining, isSelected, onSelectItem, editLink, onDragStart, onDrop,
}: CardProps) {
  const t = useTheme();
  const styles = useStyles();
  const exhausted = !isThemeItem && remaining <= 0;
  // Wallpapers and floorings are applied with a tap; furniture with copies left can be dragged.
  const draggable = !isThemeItem && !exhausted;

  const press = useCallback(() => {
    if (isThemeItem) onSelectItem(item);
    else if (isSelected) onSelectItem(null);
    else if (!exhausted) onSelectItem(item);
  }, [isThemeItem, isSelected, exhausted, item, onSelectItem]);
  const begin = useCallback(() => onDragStart(item), [onDragStart, item]);

  const dragging = useSharedValue(false);
  const gesture = useMemo(() => {
    const { pointer } = editLink;
    const start = (e: { absoluteX: number; absoluteY: number }) => {
      'worklet';
      // Another finger already has a card out.
      if (pointer.get().active) return;
      dragging.set(true);
      pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
      scheduleOnRN(begin);
    };
    const move = (e: { absoluteX: number; absoluteY: number }) => {
      'worklet';
      if (dragging.get()) pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
    };
    const end = () => {
      'worklet';
      if (!dragging.get()) return;
      dragging.set(false);
      pointer.set({ ...pointer.get(), active: false });
      scheduleOnRN(onDrop);
    };
    const hold = Gesture.Pan().enabled(draggable).activateAfterLongPress(HOLD_MS)
      .onStart(start).onUpdate(move).onFinalize(end);
    const swipeOut = Gesture.Pan().enabled(draggable).activeOffsetY(-SWIPE_OUT).failOffsetX([-SWIPE_OUT, SWIPE_OUT])
      .onStart(start).onUpdate(move).onFinalize(end);
    const tap = Gesture.Tap().maxDuration(HOLD_MS - 10).onEnd((_e, success) => {
      if (success) scheduleOnRN(press);
    });
    return Gesture.Race(tap, hold, swipeOut);
  }, [editLink, dragging, draggable, begin, onDrop, press]);

  // The card stays behind, faded, while its copy is out in the room.
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(dragging.get() ? 0.35 : 1, { duration: 120 }) }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.itemCard, isSelected && styles.itemCardSelected, exhausted && styles.itemCardExhausted, fade]}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityHint={draggable ? 'Hold and drag into the room to place it' : undefined}
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
      </Animated.View>
    </GestureDetector>
  );
}
