import {
  FilterMode,
  MipmapMode,
  PaintStyle,
  Picture,
  Skia,
  StrokeJoin,
  TileMode,
  createPicture,
  type SkCanvas,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import {
  TEXTURE_PX_PER_CELL,
  TILE_H,
  TILE_W,
  WALL_HEIGHT,
  gridToScreen,
  roomCorner,
  type GridOrigin,
  type ScreenPoint,
} from '@/constants/grid';
import { useTheme, type ThemeColors } from '@/constants/theme';
import type { Door } from '@chat-app/shared-types';
import type { RoomScene } from '../../core/contract';
import { doorWallSpan } from '../../core/doors';
import { useSkImage } from './imageCache';

/** Shear that makes a flat wall texture follow an isometric grid axis (tan of the axis angle). */
const WALL_SLOPE = TILE_H / TILE_W;

const DOOR_MAT_ALPHA = { entry: 0.3, other: 0.18 };

/** Door art. Lengths are in grid units: `u` across the door from its start along the wall, `v` rows up it. Pixel sizes say so. */
const DOOR_ART = {
  /** The casing around the opening. */
  frameInset: 0.05,
  /** The door leaf inside the casing. */
  leafInset: 0.15,
  leafTopGap: 0.09,
  /** Plank seams on the leaf, as fractions of its width. */
  seams: [1 / 3, 2 / 3],
  knobFromEdge: 0.12,
  knobHeight: 0.9,
  knobRadiusPx: 3.5,
  /** How far the step sticks out onto the floor. */
  sillDepth: 0.1,
  sillInset: 0.02,
  /** The mat, inset from its floor cell. */
  matInset: 0.12,
  outlinePx: 2.5,
  linePx: 1.5,
};

/** Screen pixels one surface reaches under the next, so no seam shows between them. */
const SEAM_OVERLAP = 1.5;

/**
 * Fills `shape` with `image` repeated in x and y. `[a, b, c, d]` is the linear part of the map
 * from texture pixels to screen pixels (screen = origin + p * (a, c) + q * (b, d)). The shape
 * clips it, so a texture never draws past the surface whatever the room's size, and a partial
 * repeat at an edge is cut off rather than squeezed.
 */
function fillTiled(canvas: SkCanvas, image: SkImage, shape: SkPath, origin: ScreenPoint, [a, b, c, d]: number[]) {
  const local = Skia.Matrix([a, b, origin.x, c, d, origin.y, 0, 0, 1]);
  const paint = Skia.Paint();
  paint.setShader(image.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, MipmapMode.Linear, local));
  canvas.drawPath(shape, paint);
}

function polygon(points: ScreenPoint[]): SkPath {
  return Skia.PathBuilder.Make().addPoly(points, true).build();
}

/** Draws a filled or stroked shape. `alpha` multiplies the colour's own. */
function paintOf(color: string, { stroke = 0, alpha = 1 }: { stroke?: number; alpha?: number } = {}) {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  paint.setAntiAlias(true);
  if (stroke > 0) {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke);
    paint.setStrokeJoin(StrokeJoin.Round);
  }
  return paint;
}

/**
 * A door standing on its wall (see doorWallSpan), drawn flat on the wall plane so it shears
 * with it: a casing outlined in ink, a wooden leaf with plank seams, a gold knob on its right
 * as seen on screen, and a step out onto the floor.
 */
function drawWallDoor(canvas: SkCanvas, door: Door, origin: GridOrigin, colors: ThemeColors) {
  const span = doorWallSpan(door);
  if (!span) return;
  const A = DOOR_ART;
  const width = span.width;
  const height = span.rows;
  const start = span.col - 0.5;
  // A point on the door: `u` across it from its start along the wall, `v` rows up, `out` onto the floor.
  const at = (u: number, v: number, out = 0) => span.wall === 'right'
    ? gridToScreen(start + u, -0.5 + out, v, origin)
    : gridToScreen(-0.5 + out, start + u, v, origin);
  /** A rectangle on the wall across u0..u1, from v0 up to v1. */
  const rect = (u0: number, u1: number, v0: number, v1: number) =>
    polygon([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]);

  const ink = colors.roomDoorStroke;

  // Casing, then the leaf inside it, its top a little below the casing's.
  const casing = rect(A.frameInset, width - A.frameInset, 0, height);
  canvas.drawPath(casing, paintOf(colors.roomDoorWoodDeep));
  const leafTop = height - A.leafTopGap;
  canvas.drawPath(rect(A.leafInset, width - A.leafInset, 0, leafTop), paintOf(colors.roomDoorWood));

  // Plank seams run the leaf's height.
  const seam = paintOf(colors.roomDoorWoodDeep, { stroke: A.linePx });
  for (const f of A.seams) {
    const u = A.leafInset + f * (width - 2 * A.leafInset);
    const p0 = at(u, 0.04);
    const p1 = at(u, leafTop - 0.04);
    canvas.drawLine(p0.x, p0.y, p1.x, p1.y, seam);
  }
  // A lit edge down the leaf's screen-left side (the far end along the left wall).
  const litU = span.wall === 'left' ? width - A.leafInset - 0.05 : A.leafInset + 0.05;
  const l0 = at(litU, 0.06);
  const l1 = at(litU, leafTop - 0.06);
  canvas.drawLine(l0.x, l0.y, l1.x, l1.y, paintOf(colors.roomDoorWoodLight, { stroke: A.linePx }));

  canvas.drawPath(casing, paintOf(ink, { stroke: A.outlinePx }));

  // Screen right is toward the corner on the left wall (its axis runs leftward), away from it on the right wall.
  const knobU = span.wall === 'left' ? A.leafInset + A.knobFromEdge : width - A.leafInset - A.knobFromEdge;
  const knob = at(knobU, A.knobHeight);
  canvas.drawCircle(knob.x, knob.y, A.knobRadiusPx, paintOf(colors.roomDoorKnob));
  canvas.drawCircle(knob.x, knob.y, A.knobRadiusPx, paintOf(ink, { stroke: A.linePx }));
  canvas.drawCircle(knob.x - 1, knob.y - 1, 1, paintOf(colors.roomDoorGlint));

  // The step: a strip of floor in front of the casing.
  const sill = polygon([
    at(A.sillInset, 0), at(width - A.sillInset, 0),
    at(width - A.sillInset, 0, A.sillDepth), at(A.sillInset, 0, A.sillDepth),
  ]);
  canvas.drawPath(sill, paintOf(colors.roomDoorWoodDeep));
  canvas.drawPath(sill, paintOf(ink, { stroke: A.linePx }));
}

function matColor(door: Door, colors: ThemeColors): string {
  return door.isEntry ? colors.roomDoorEntry : colors.roomDoor;
}

/** Each door's mat: a rug on its floor cell, where people come in (mint for the entry door). */
function drawDoorMat(canvas: SkCanvas, door: Door, origin: GridOrigin, colors: ThemeColors) {
  const { x: gx, y: gy } = door.position;
  const h = 0.5 - DOOR_ART.matInset;
  const path = polygon([
    gridToScreen(gx - h, gy - h, 0, origin),
    gridToScreen(gx + h, gy - h, 0, origin),
    gridToScreen(gx + h, gy + h, 0, origin),
    gridToScreen(gx - h, gy + h, 0, origin),
  ]);
  const mat = matColor(door, colors);
  canvas.drawPath(path, paintOf(mat, { alpha: door.isEntry ? DOOR_MAT_ALPHA.entry : DOOR_MAT_ALPHA.other }));
  canvas.drawPath(path, paintOf(mat, { stroke: 2 }));
}

function drawDoors(canvas: SkCanvas, doors: RoomScene['doors'], origin: GridOrigin, colors: ThemeColors) {
  for (const door of doors) drawDoorMat(canvas, door, origin, colors);
  for (const door of doors) drawWallDoor(canvas, door, origin, colors);
}

interface Props {
  scene: RoomScene;
  origin: GridOrigin;
}

/**
 * Walls, floor and doors (each on its wall, with a mat on its floor cell), recorded once into an SkPicture.
 * Re-recorded only when the room, its theme images or the canvas origin change.
 *
 * Floorings and wallpapers are flat, seamless textures (TEXTURE_PX_PER_CELL pixels per cell)
 * tiled across each surface from the back corner where the walls meet, so both walls' patterns
 * meet there and a bigger room shows more repeats instead of a stretched image.
 */
export function Backdrop({ scene, origin }: Props) {
  const { colors } = useTheme();
  const leftWall = useSkImage(scene.theme?.leftWall?.assetUrl);
  const rightWall = useSkImage(scene.theme?.rightWall?.assetUrl);
  const floor = useSkImage(scene.theme?.floor?.assetUrl);

  const roomX = scene.dimensions.x;
  const roomY = scene.dimensions.y;

  const picture = useMemo(() => createPicture(canvas => {
    // The floor's back corner; the walls stand on the floor's back edges and meet above it.
    const corner = roomCorner(origin);
    const wallTop: ScreenPoint = { x: corner.x, y: corner.y - WALL_HEIGHT };
    // The floor's other corners: right (end of the x axis), front, left (end of the y axis).
    const right = gridToScreen(roomX - 0.5, -0.5, 0, origin);
    const front = gridToScreen(roomX - 0.5, roomY - 0.5, 0, origin);
    const left = gridToScreen(-0.5, roomY - 0.5, 0, origin);
    const up = (p: ScreenPoint): ScreenPoint => ({ x: p.x, y: p.y - WALL_HEIGHT });

    // A wall cell is TILE_W/2 wide along the wall and TILE_H tall, so one texture pixel is this
    // many screen pixels both ways; the wall's slope then shears it onto the grid axis.
    const wallScale = TILE_H / TEXTURE_PX_PER_CELL;
    // Shapes that only touch leave a hairline of background along the shared edge once
    // anti-aliased, so the walls reach under the floor and the left wall over the corner line.
    const down = (p: ScreenPoint): ScreenPoint => ({ x: p.x, y: p.y + SEAM_OVERLAP });
    const over = (p: ScreenPoint): ScreenPoint => ({ x: p.x + SEAM_OVERLAP, y: p.y });
    if (rightWall) {
      fillTiled(canvas, rightWall, polygon([wallTop, up(right), down(right), down(corner)]), wallTop,
        [wallScale, 0, wallScale * WALL_SLOPE, wallScale]);
    }
    if (leftWall) {
      // Runs left from the corner unmirrored: texture x still points right on screen, and the
      // repeat covers the negative side.
      fillTiled(canvas, leftWall, polygon([up(left), over(wallTop), over(down(corner)), down(left)]), wallTop,
        [wallScale, 0, -wallScale * WALL_SLOPE, wallScale]);
    }

    // Texture x runs along the grid's x axis and texture y along its y axis, one cell per
    // TEXTURE_PX_PER_CELL pixels. Drawn after the walls so it masks their bottoms.
    if (floor) {
      const cell = 1 / TEXTURE_PX_PER_CELL;
      fillTiled(canvas, floor, polygon([corner, right, front, left]), corner,
        [cell * (TILE_W / 2), -cell * (TILE_W / 2), cell * (TILE_H / 2), cell * (TILE_H / 2)]);
    }

    drawDoors(canvas, scene.doors ?? [], origin, colors);
  }), [leftWall, rightWall, floor, roomX, roomY, origin, scene.doors, colors]);

  return <Picture picture={picture} />;
}
