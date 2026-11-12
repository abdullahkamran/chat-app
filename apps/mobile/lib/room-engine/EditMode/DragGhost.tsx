import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { resolveItemSource } from '@/constants/avatarAssets';
import type { EditLink, EditDrag } from '../core/contract';

const SIZE = 64;
/** Gap between the fingertip and the ghost's bottom, so the finger doesn't hide it. */
const ABOVE_FINGER = 16;

interface Props {
  drag: EditDrag | null;
  link: EditLink;
  /** Where the layer the ghost is drawn in sits in the window. */
  layerOffset: SharedValue<{ x: number; y: number }>;
}

/**
 * The dragged item under the finger while it is over the inventory drawer. Over the room
 * the engine draws the item itself, following the finger.
 */
export function DragGhost({ drag, link, layerOffset }: Readonly<Props>) {
  const visible = drag?.over === 'away';
  const follow = useAnimatedStyle(() => {
    const p = link.pointer.get();
    const o = layerOffset.get();
    return {
      transform: [
        { translateX: p.x - o.x - SIZE / 2 },
        { translateY: p.y - o.y - SIZE - ABOVE_FINGER },
      ],
    };
  });
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.ghost, follow]}>
      <Image source={resolveItemSource(drag.item.itemId.assetUrl) ?? undefined} style={styles.image} contentFit="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    opacity: 0.9,
  },
  image: { width: SIZE, height: SIZE },
});
