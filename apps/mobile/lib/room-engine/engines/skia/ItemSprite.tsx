import { Group, Image, Rect, useImage, type DataSourceParam } from '@shopify/react-native-skia';

import { resolveItemSource } from '@/constants/avatarAssets';
import type { GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { RoomItem } from '@chat-app/shared-types';
import { itemRect } from './geometry';

const SELECTED_SCALE = 1.08;
const SELECTED_OPACITY = 0.7;
const SELECTED_TINT_OPACITY = 0.25;

interface Props {
  roomItem: RoomItem;
  origin: GridOrigin;
  selected: boolean;
}

/** One placed item, fitted into its isometric footprint rectangle. Selected items are enlarged and tinted. */
export function ItemSprite({ roomItem, origin, selected }: Props) {
  const image = useImage(resolveItemSource(roomItem.itemId.assetUrl) as DataSourceParam);
  const rect = itemRect(roomItem, origin);

  if (!selected) {
    return <Image image={image} fit="contain" {...rect} />;
  }

  return (
    <Group
      opacity={SELECTED_OPACITY}
      origin={{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }}
      transform={[{ scale: SELECTED_SCALE }]}
    >
      <Image image={image} fit="contain" {...rect} />
      <Rect {...rect} color={theme.colors.primary} opacity={SELECTED_TINT_OPACITY} />
    </Group>
  );
}
