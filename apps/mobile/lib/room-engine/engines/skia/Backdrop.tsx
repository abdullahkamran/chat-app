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
import { addFloorCell } from './cellPaths';
import { useSkImage } from './imageCache';

/** Shear that makes a flat wall texture follow an isometric grid axis (tan of the axis angle). */
const WALL_SLOPE = TILE_H / TILE_W;

const DOOR_MAT_ALPHA = { entry: 0.25, other: 0.15 };

/** Door art, in grid units along the wall and rows up it (knob radius in pixels). */
const DOOR_ART = {
  frameInset: 0.06,
  faceInset: 0.14,
  lintel: 0.1,
  panelInset: 0.26,
  panelAlpha: 0.3,
  knobInset: 0.24,
  knobRadius: 3.5,
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
 * A door standing on its wall (see doorWallSpan): an ink frame, a wooden face with two inset
 * panels, and a gold knob on its right as seen on screen, all flat on the wall plane so they
 * shear with it.
 */
function drawWallDoor(canvas: SkCanvas, door: Door, origin: GridOrigin, colors: ThemeColors) {
  const span = doorWallSpan(door);
  if (!span) return;
  // A point on the wall: `along` the wall's grid axis, `z` rows up.
  const at = (along: number, z: number) => span.wall === 'right'
    ? gridToScreen(along, -0.5, z, origin)
    : gridToScreen(-0.5, along, z, origin);
  const start = span.col - 0.5;
  const end = start + span.width;
  const top = span.rows;
  const quad = (inset: number, z0: number, z1: number) =>
    polygon([at(start + inset, z0), at(end - inset, z0), at(end - inset, z1), at(start + inset, z1)]);

  const ink = colors.roomDoorStroke;
  canvas.drawPath(quad(DOOR_ART.frameInset, 0, top), paintOf(ink));
  canvas.drawPath(quad(DOOR_ART.faceInset, 0, top - DOOR_ART.lintel), paintOf(colors.roomDoorWood));

  const panels = paintOf(ink, { stroke: 2, alpha: DOOR_ART.panelAlpha });
  const split = top * 0.5;
  canvas.drawPath(quad(DOOR_ART.panelInset, split + 0.1, top - DOOR_ART.lintel - 0.2), panels);
  canvas.drawPath(quad(DOOR_ART.panelInset, 0.2, split - 0.1), panels);

  // Screen right is toward the corner on the left wall (its axis runs leftward), away from it on the right wall.
  const knob = at(span.wall === 'left' ? start + DOOR_ART.knobInset : end - DOOR_ART.knobInset, split);
  canvas.drawCircle(knob.x, knob.y, DOOR_ART.knobRadius, paintOf(colors.roomDoorKnob));
  canvas.drawCircle(knob.x, knob.y, DOOR_ART.knobRadius, paintOf(ink, { stroke: 1.5 }));
}

function matColor(door: Door, colors: ThemeColors): string {
  return door.isEntry ? colors.roomDoorEntry : colors.roomDoor;
}

/** Each door's mat: its floor cell, where people come in, tinted (mint for the entry door). */
function drawDoorMat(canvas: SkCanvas, door: Door, origin: GridOrigin, colors: ThemeColors) {
  const builder = Skia.PathBuilder.Make();
  addFloorCell(builder, door.position.x, door.position.y, origin);
  const path = builder.build();
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
