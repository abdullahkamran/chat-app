import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { WALL_ROWS, type GridOrigin } from '@/constants/grid';
import { useTheme } from '@/constants/theme';
import type { Dimensions } from '@chat-app/shared-types';
import type { EditCell } from '../../core/contract';
import { addFloorCell, addWallCell, addWallCells } from './cellPaths';

const FILL_OPACITY = 0.08;
const HIGHLIGHT_OPACITY = 0.45;

interface Props {
  dimensions: Dimensions;
  origin: GridOrigin;
  /** Which cells the chosen item can go on: the floor's, or the walls' for a wall item. */
  surface: 'floor' | 'wall';
  /** The cells a dragged item would cover, and whether it can be dropped there. */
  highlight?: { cells: readonly EditCell[]; valid: boolean } | null;
}

/**
 * Edit-mode grid: one outline per cell, as a single path, and the cells under a dragged
 * item filled in: the drop colour where it can go, the blocked colour where it can't.
 * Cells are centred on grid vertices, matching item anchoring.
 */
export function EditGrid({ dimensions, origin, surface, highlight }: Props) {
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

  const cells = highlight?.cells;
  const highlightPath = useMemo(() => {
    if (!cells?.length) return null;
    const builder = Skia.PathBuilder.Make();
    for (const c of cells) {
      if (c.surface === 'floor') addFloorCell(builder, c.gx, c.gy, origin);
      else addWallCell(builder, c, origin);
    }
    return builder.build();
  }, [cells, origin]);
  const highlightColor = highlight?.valid ? colors.roomDropTarget : colors.roomDropBlocked;

  return (
    <Group>
      <Path path={path} color={colors.roomEditGrid} opacity={FILL_OPACITY} />
      <Path path={path} color={colors.roomEditGrid} style="stroke" strokeWidth={1} />
      {highlightPath && (
        <Group>
          <Path path={highlightPath} color={highlightColor} opacity={HIGHLIGHT_OPACITY} />
          <Path path={highlightPath} color={highlightColor} style="stroke" strokeWidth={2} />
        </Group>
      )}
    </Group>
  );
}
