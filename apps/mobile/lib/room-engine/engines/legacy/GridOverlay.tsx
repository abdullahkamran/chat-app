import { TouchableOpacity, View } from 'react-native';
import { theme } from '@/constants/theme';
import { TILE_H, TILE_W, gridToScreen, type GridOrigin } from '@/constants/grid';
import { type Dimensions, type RoomItem, type Item } from '@chat-app/shared-types';

interface Props {
  roomDimensions: Dimensions;
  origin: GridOrigin;
  canvasWidth: number;
  canvasHeight: number;
  pendingItems: RoomItem[];
  selectedItem: Item | null;
  onCellPress: (gx: number, gy: number) => void;
}

/**
 * Renders a semi-transparent isometric grid over the floor.
 * Tapping a cell calls onCellPress with the grid coordinates.
 */
export function GridOverlay({
  roomDimensions,
  origin,
  canvasWidth,
  canvasHeight,
  onCellPress,
}: Props) {
  const cells: React.ReactNode[] = [];

  for (let gx = 0; gx < roomDimensions.x; gx++) {
    for (let gy = 0; gy < roomDimensions.y; gy++) {
      const { x, y } = gridToScreen(gx, gy, 0, origin);

      cells.push(
        <TouchableOpacity
          key={`cell-${gx}-${gy}`}
          activeOpacity={0.6}
          onPress={() => onCellPress(gx, gy)}
          style={{
            position: 'absolute',
            left: x - TILE_W / 2,
            top: y - TILE_H / 2,
            width: TILE_W,
            height: TILE_H,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            backgroundColor: 'rgba(255, 252, 0, 0.08)',
          }}
        />,
      );
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
      }}
    >
      {cells}
    </View>
  );
}
