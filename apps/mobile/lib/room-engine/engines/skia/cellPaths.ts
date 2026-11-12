import type { SkPathBuilder } from '@shopify/react-native-skia';

import { gridToScreen, type GridOrigin, type WallCell } from '@/constants/grid';

/** One floor cell; cells are centred on grid vertices, as in cellAt. */
export function addFloorCell(builder: SkPathBuilder, gx: number, gy: number, origin: GridOrigin) {
  'worklet';
  builder.addPoly([
    gridToScreen(gx - 0.5, gy - 0.5, 0, origin),
    gridToScreen(gx + 0.5, gy - 0.5, 0, origin),
    gridToScreen(gx + 0.5, gy + 0.5, 0, origin),
    gridToScreen(gx - 0.5, gy + 0.5, 0, origin),
  ], true);
}

/** One wall cell, on the floor's back edge (gy = -0.5 for the right wall, gx = -0.5 for the left), as in wallCellAt. */
export function addWallCell(builder: SkPathBuilder, { wall, col, row }: WallCell, origin: GridOrigin) {
  const at = (along: number, z: number) =>
    wall === 'right' ? gridToScreen(along - 0.5, -0.5, z, origin) : gridToScreen(-0.5, along - 0.5, z, origin);
  builder.addPoly([at(col, row), at(col + 1, row), at(col + 1, row + 1), at(col, row + 1)], true);
}

/** Every wall cell of a room this size. */
export function addWallCells(builder: SkPathBuilder, dims: { x: number; y: number }, rows: number, origin: GridOrigin) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < dims.x; col++) addWallCell(builder, { wall: 'right', col, row }, origin);
    for (let col = 0; col < dims.y; col++) addWallCell(builder, { wall: 'left', col, row }, origin);
  }
}
