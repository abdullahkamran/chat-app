import { Image } from 'expo-image';
import { TouchableOpacity, View } from 'react-native';

import { resolveItemSource } from '@/constants/avatarAssets';
import { theme } from '@/constants/theme';
import { TILE_H, TILE_W, getEffectiveDimensions, gridToScreen, type GridOrigin } from '@/constants/grid';
import { ItemAction, type RoomItem } from '@chat-app/shared-types';

interface Props {
  roomItem: RoomItem;
  origin: GridOrigin;
  onActionPress?: (roomItem: RoomItem) => void;
  isSelectedInEditMode?: boolean;
}

/**
 * Renders a single placed room item at its isometric grid position.
 * Tapping items with an action triggers onActionPress (walk-to + animate).
 * In edit mode, isSelectedInEditMode adds a yellow highlight overlay.
 */
export function RoomItemView({ roomItem, origin, onActionPress, isSelectedInEditMode }: Props) {
  const item = roomItem.itemId;
  const dims = getEffectiveDimensions(item.dimensions, roomItem.orientation);
  const { x: gx, y: gy, z: gz } = roomItem.position;

  // Anchor to the front-bottom corner of the item footprint
  const screen = gridToScreen(gx, gy, gz, origin);

  // Pixel size: item spans dims.x tiles in x and dims.y tiles in y
  const pixelW = (dims.x + dims.y) * (TILE_W / 2);
  const pixelH = (dims.x + dims.y) * (TILE_H / 2) + dims.z * TILE_H;

  const source = resolveItemSource(item.assetUrl);
  const hasAction = item.action !== ItemAction.NONE;

  const imageEl = (
    <Image
      source={source ?? undefined}
      style={{ width: pixelW, height: pixelH }}
      contentFit="contain"
    />
  );

  return (
    <View
      style={{
        position: 'absolute',
        left: screen.x - pixelW / 2,
        top: screen.y - pixelH,
        zIndex: gx + gy,
        opacity: isSelectedInEditMode ? 0.7 : 1,
        transform: isSelectedInEditMode ? [{ scale: 1.08 }] : undefined,
      }}
    >
      {hasAction ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => onActionPress?.(roomItem)}>
          {imageEl}
        </TouchableOpacity>
      ) : (
        imageEl
      )}
      {isSelectedInEditMode && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.colors.primary,
            opacity: 0.25,
          }}
        />
      )}
    </View>
  );
}
