import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { WALL_ROWS, getEffectiveDimensions, type GridOrigin } from '@/constants/grid';
import { useTheme } from '@/constants/theme';
import { ItemPlacement, type Dimensions, type RoomItem } from '@chat-app/shared-types';
import { wallCellsOf } from '../../core/editLayout';
import type { ActorMotion } from './actorMotion';
import { addFloorCell, addWallCell, addWallCells } from './cellPaths';

// Inlined by Expo at bundle time; restart Metro with -c after changing them.
/** Orange on cells placed items occupy, blue on the cell each avatar stands on. */
export const DEBUG_OCCUPANCY = __DEV__ && process.env.EXPO_PUBLIC_ROOM_DEBUG_OCCUPANCY === '1';
/** Every floor and wall cell, outlined over the room. */
export const DEBUG_CELL_MAP = __DEV__ && process.env.EXPO_PUBLIC_ROOM_DEBUG_CELL_MAP === '1';

const MAP_OPACITY = 0.35;
const MARKER_FILL_OPACITY = 0.35;

/** Floor cells, plus the wall cells on the floor's back edges, one row per grid unit of height. */
function CellMap({ dimensions, origin }: { dimensions: Dimensions; origin: GridOrigin }) {
  const { colors } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let gx = 0; gx < dimensions.x; gx++) {
      for (let gy = 0; gy < dimensions.y; gy++) addFloorCell(builder, gx, gy, origin);
    }
    addWallCells(builder, { x: dimensions.x, y: dimensions.y }, WALL_ROWS, origin);
    return builder.build();
  }, [dimensions.x, dimensions.y, origin]);

  return <Path path={path} color={colors.roomDebugGrid} style="stroke" strokeWidth={1} opacity={MAP_OPACITY} />;
}

/** Every cell covered by a placed item: a floor item's footprint or a wall item's wall cells, overlappable ones included. */
function ItemCells({ items, origin }: { items: readonly RoomItem[]; origin: GridOrigin }) {
  const { colors } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const ri of items) {
      if (ri.itemId.placement === ItemPlacement.WALL) {
        for (const cell of wallCellsOf(ri)) addWallCell(builder, cell, origin);
        continue;
      }
      const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
      for (let dx = 0; dx < dims.x; dx++) {
        for (let dy = 0; dy < dims.y; dy++) addFloorCell(builder, ri.position.x + dx, ri.position.y + dy, origin);
      }
    }
    return builder.build();
  }, [items, origin]);

  return (
    <Group>
      <Path path={path} color={colors.roomDebugItemCell} opacity={MARKER_FILL_OPACITY} />
      <Path path={path} color={colors.roomDebugItemCell} style="stroke" strokeWidth={2} />
    </Group>
  );
}

/** The cell under each avatar's animated position, rebuilt on the UI thread as they move. */
function ActorCells({ motions, origin }: { motions: ReadonlyMap<string, ActorMotion>; origin: GridOrigin }) {
  const { colors } = useTheme();
  const list = useMemo(() => [...motions.values()], [motions]);
  const path = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    for (const m of list) addFloorCell(builder, Math.round(m.gx.get()), Math.round(m.gy.get()), origin);
    return builder.build();
  }, [list, origin]);

  return (
    <Group>
      <Path path={path} color={colors.roomDebugActorCell} opacity={MARKER_FILL_OPACITY} />
      <Path path={path} color={colors.roomDebugActorCell} style="stroke" strokeWidth={2} />
    </Group>
  );
}

interface Props {
  dimensions: Dimensions;
  items: readonly RoomItem[];
  motions: ReadonlyMap<string, ActorMotion>;
  origin: GridOrigin;
}

/** Dev-only cell overlays, drawn over the world. Each is switched by its own env flag. */
export function DebugOverlay({ dimensions, items, motions, origin }: Props) {
  return (
    <Group>
      {DEBUG_CELL_MAP && <CellMap dimensions={dimensions} origin={origin} />}
      {DEBUG_OCCUPANCY && <ItemCells items={items} origin={origin} />}
      {DEBUG_OCCUPANCY && <ActorCells motions={motions} origin={origin} />}
    </Group>
  );
}
