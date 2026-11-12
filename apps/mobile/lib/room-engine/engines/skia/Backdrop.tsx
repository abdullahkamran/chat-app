import {
  FilterMode,
  MipmapMode,
  PaintStyle,
  Picture,
  Skia,
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
import type { RoomScene } from '../../core/contract';
import { useSkImage } from './imageCache';

/** Shear that makes a flat wall texture follow an isometric grid axis (tan of the axis angle). */
const WALL_SLOPE = TILE_H / TILE_W;

const DOOR_FILL_ALPHA = { entry: 0.25, other: 0.15 };

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

function drawDoors(canvas: SkCanvas, doors: RoomScene['doors'], origin: GridOrigin, colors: ThemeColors) {
  for (const door of doors) {
    const { x: gx, y: gy } = door.position;
    const path = polygon([
      gridToScreen(gx - 0.5, gy - 0.5, 0, origin),
      gridToScreen(gx + 0.5, gy - 0.5, 0, origin),
      gridToScreen(gx + 0.5, gy + 0.5, 0, origin),
      gridToScreen(gx - 0.5, gy + 0.5, 0, origin),
    ]);

    const fill = Skia.Paint();
    fill.setColor(Skia.Color(door.isEntry ? colors.roomDoorEntry : colors.roomDoor));
    fill.setAlphaf(door.isEntry ? DOOR_FILL_ALPHA.entry : DOOR_FILL_ALPHA.other);
    canvas.drawPath(path, fill);

    const stroke = Skia.Paint();
    stroke.setColor(Skia.Color(door.isEntry ? colors.roomDoorEntry : colors.roomDoorStroke));
    stroke.setStyle(PaintStyle.Stroke);
    stroke.setStrokeWidth(2);
    canvas.drawPath(path, stroke);
  }
}

interface Props {
  scene: RoomScene;
  origin: GridOrigin;
}

/**
 * Walls, floor and door markers, recorded once into an SkPicture.
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
