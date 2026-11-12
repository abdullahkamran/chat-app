import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { WALL_ROWS, type GridOrigin } from '@/constants/grid';
import { useTheme } from '@/constants/theme';
import type { Dimensions } from '@chat-app/shared-types';
import { addFloorCell, addWallCells } from './cellPaths';

const FILL_OPACITY = 0.08;

interface Props {
  dimensions: Dimensions;
  origin: GridOrigin;
  /** Which cells the chosen item can go on: the floor's, or the walls' for a wall item. */
  surface: 'floor' | 'wall';
}

/**
 * Edit-mode grid: one outline per cell, as a single path.
 * Cells are centred on grid vertices, matching item anchoring.
 */
export function EditGrid({ dimensions, origin, surface }: Props) {
  const { colors } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    if (surface === 'wall') {
      addWallCells(builder, { x: dimensions.x, y: dimensions.y }, WALL_ROWS, origin);
    } else {
      for (let gx = 0; gx < dimensions.x; gx++) {
        for (let gy = 0; gy < dimensions.y; gy++) addFloorCell(builder, gx, gy, origin);
      }
    }
    return builder.build();
  }, [dimensions.x, dimensions.y, origin, surface]);

  return (
    <Group>
      <Path path={path} color={colors.roomEditGrid} opacity={FILL_OPACITY} />
      <Path path={path} color={colors.roomEditGrid} style="stroke" strokeWidth={1} />
    </Group>
  );
}
