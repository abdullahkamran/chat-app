import { Group, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { TILE_H, WALL_HEIGHT, getEffectiveDimensions, gridToScreen, type GridOrigin } from '@/constants/grid';
import { useTheme } from '@/constants/theme';
import type { Dimensions, RoomItem } from '@chat-app/shared-types';
import type { ActorMotion } from './actorMotion';

// Inlined by Expo at bundle time; restart Metro with -c after changing them.
/** Orange on cells placed items occupy, blue on the cell each avatar stands on. */
export const DEBUG_OCCUPANCY = __DEV__ && process.env.EXPO_PUBLIC_ROOM_DEBUG_OCCUPANCY === '1';
/** Every floor and wall cell, outlined over the room. */
export const DEBUG_CELL_MAP = __DEV__ && process.env.EXPO_PUBLIC_ROOM_DEBUG_CELL_MAP === '1';

const MAP_OPACITY = 0.35;
const MARKER_FILL_OPACITY = 0.35;
const WALL_ROWS = WALL_HEIGHT / TILE_H;

/** One floor cell; cells are centred on grid vertices, as in EditGrid and cellAt. */
function addCell(builder: SkPathBuilder, gx: number, gy: number, origin: GridOrigin) {
  'worklet';
  builder.addPoly([
    gridToScreen(gx - 0.5, gy - 0.5, 0, origin),
    gridToScreen(gx + 0.5, gy - 0.5, 0, origin),
    gridToScreen(gx + 0.5, gy + 0.5, 0, origin),
    gridToScreen(gx - 0.5, gy + 0.5, 0, origin),
  ], true);
}

/**
 * Floor cells, plus one-tile wall cells on the planes the wall images are drawn on
 * (gy = 0 for the right wall, gx = 0 for the left), one row per grid unit of height.
 */
function CellMap({ dimensions, origin }: { dimensions: Dimensions; origin: GridOrigin }) {
  const { colors } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let gx = 0; gx < dimensions.x; gx++) {
      for (let gy = 0; gy < dimensions.y; gy++) addCell(builder, gx, gy, origin);
    }
    for (let z = 0; z < WALL_ROWS; z++) {
      for (let gx = 0; gx < dimensions.x; gx++) {
        builder.addPoly([
          gridToScreen(gx, 0, z, origin),
          gridToScreen(gx + 1, 0, z, origin),
          gridToScreen(gx + 1, 0, z + 1, origin),
          gridToScreen(gx, 0, z + 1, origin),
        ], true);
      }
      for (let gy = 0; gy < dimensions.y; gy++) {
        builder.addPoly([
          gridToScreen(0, gy, z, origin),
          gridToScreen(0, gy + 1, z, origin),
          gridToScreen(0, gy + 1, z + 1, origin),
          gridToScreen(0, gy, z + 1, origin),
        ], true);
      }
    }
    return builder.build();
  }, [dimensions.x, dimensions.y, origin]);

  return <Path path={path} color={colors.roomDebugGrid} style="stroke" strokeWidth={1} opacity={MAP_OPACITY} />;
}

/** Every cell covered by a placed item's footprint, overlappable ones included. */
function ItemCells({ items, origin }: { items: readonly RoomItem[]; origin: GridOrigin }) {
  const { colors } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const ri of items) {
      const dims = getEffectiveDimensions(ri.itemId.dimensions, ri.orientation);
      for (let dx = 0; dx < dims.x; dx++) {
        for (let dy = 0; dy < dims.y; dy++) addCell(builder, ri.position.x + dx, ri.position.y + dy, origin);
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
    for (const m of list) addCell(builder, Math.round(m.gx.get()), Math.round(m.gy.get()), origin);
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
