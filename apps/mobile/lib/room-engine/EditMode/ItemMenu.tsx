import { View, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { AppText, Button } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import type { EditLink } from '../core/contract';

/** Gap between the item's art and the menu. */
const GAP = 8;
/** The menu keeps this far from the screen's sides. */
const SIDE_MARGIN = 12;

interface Props {
  link: EditLink;
  /** Where the layer the menu is drawn in sits in the window. */
  layerOffset: SharedValue<{ x: number; y: number }>;
  /** Window y of the room's top edge: the menu goes under the item rather than over the toolbar. */
  roomTop: SharedValue<number>;
  /** Floor items turn; wall items would flip onto the other wall. */
  canRotate: boolean;
  /**
   * Set when another owner placed the item: removing it gives it back to them. Empty
   * while their name loads.
   */
  placedByName?: string | null;
  disabled?: boolean;
  onRotate: () => void;
  onRemove: () => void;
}

const useStyles = makeStyles(t => ({
  anchor: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  card: {
    gap: t.space.sm,
    padding: t.space.sm,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surfaceElevated,
    alignItems: 'center',
    ...t.shadows.floating,
  },
  actions: {
    flexDirection: 'row',
    gap: t.space.sm,
  },
  caption: {
    maxWidth: 220,
  },
}));

/**
 * The picked-up item's menu, like a home-screen widget's: a small card floating over the
 * item in the room, following it as the camera moves. It opens on a tap (or a hold let go
 * in place) and closes on any other tap or when the item is dragged. Under the toolbar,
 * so the room never shifts.
 */
export function ItemMenu({ link, layerOffset, roomTop, canRotate, placedByName, disabled, onRotate, onRemove }: Readonly<Props>) {
  const styles = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  const size = useSharedValue({ width: 0, height: 0 });

  const place = useAnimatedStyle(() => {
    const sel = link.selection.get();
    const { width, height } = size.get();
    // Off the item's place until it is known and measured; it stays mounted, so it can't be tapped there.
    if (!sel.visible || width === 0) return { opacity: 0, transform: [{ translateX: -10000 }, { translateY: 0 }] };
    const o = layerOffset.get();
    const above = sel.top - GAP - height;
    // Above the item, unless that would cover the toolbar: then below it.
    const top = above >= roomTop.get() ? above : sel.bottom + GAP;
    const left = Math.min(Math.max(sel.x - width / 2, SIDE_MARGIN), screenWidth - SIDE_MARGIN - width);
    return { opacity: 1, transform: [{ translateX: left - o.x }, { translateY: top - o.y }] };
  });

  return (
    <Animated.View
      style={[styles.anchor, place]}
      onLayout={e => size.set({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <Animated.View entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(100)} style={styles.card}>
        {placedByName !== undefined && (
          <AppText variant="caption" color="textSecondary" align="center" style={styles.caption} numberOfLines={2}>
            {`${placedByName ? `${placedByName}'s` : "Another owner's"}. Removing it gives it back to them`}
          </AppText>
        )}
        <View style={styles.actions}>
          {canRotate && (
            <Button title="Rotate" icon="refresh" variant="secondary" size="sm" onPress={onRotate} disabled={disabled} />
          )}
          <Button title="Remove" icon="trash-outline" variant="danger" size="sm" onPress={onRemove} disabled={disabled} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}
