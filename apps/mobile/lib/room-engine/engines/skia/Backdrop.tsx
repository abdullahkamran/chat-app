import {
  PaintStyle,
  Picture,
  Skia,
  createPicture,
  type SkCanvas,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { TILE_H, TILE_W, WALL_HEIGHT, gridToScreen, type GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { RoomScene } from '../../core/contract';
import { useSkImage } from './imageCache';

/** Shear that makes a flat wall image follow an isometric grid axis (tan of the axis angle). */
const WALL_SLOPE = TILE_H / TILE_W;

const DOOR_FILL_ALPHA = { entry: 0.25, other: 0.15 };

/** Source rectangle that crops an image to fill (w, h) without distortion — CSS `cover`. */
function coverSource(image: SkImage, w: number, h: number): SkRect {
  const iw = image.width();
  const ih = image.height();
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh);
}

function drawCover(canvas: SkCanvas, image: SkImage, dest: SkRect) {
  canvas.drawImageRect(image, coverSource(image, dest.width, dest.height), dest, Skia.Paint());
}

function drawDoors(canvas: SkCanvas, doors: RoomScene['doors'], origin: GridOrigin) {
  for (const door of doors) {
    const { x: gx, y: gy } = door.position;
    const corners = [
      gridToScreen(gx, gy, 0, origin),
      gridToScreen(gx + 1, gy, 0, origin),
      gridToScreen(gx + 1, gy + 1, 0, origin),
      gridToScreen(gx, gy + 1, 0, origin),
    ];
    const path = Skia.PathBuilder.Make().addPoly(corners, true).build();

    const fill = Skia.Paint();
    fill.setColor(Skia.Color(door.isEntry ? theme.colors.primary : theme.colors.text));
    fill.setAlphaf(door.isEntry ? DOOR_FILL_ALPHA.entry : DOOR_FILL_ALPHA.other);
    canvas.drawPath(path, fill);

    const stroke = Skia.Paint();
    stroke.setColor(Skia.Color(door.isEntry ? theme.colors.primary : theme.colors.border));
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
 */
export function Backdrop({ scene, origin }: Props) {
  const leftWall = useSkImage(scene.theme?.leftWall?.assetUrl);
  const rightWall = useSkImage(scene.theme?.rightWall?.assetUrl);
  const floor = useSkImage(scene.theme?.floor?.assetUrl);

  const roomX = scene.dimensions?.x || 8;
  const roomY = scene.dimensions?.y || 6;

  const picture = useMemo(() => createPicture(canvas => {
    const leftWallWidth = roomY * (TILE_W / 2);
    const rightWallWidth = roomX * (TILE_W / 2);

    // Walls meet at origin.x. Each is a flat image sheared along its grid axis;
    // the left one is drawn lower by its drop so its back-top corner lands at y = 0.
    if (leftWall) {
      canvas.save();
      canvas.translate(origin.x - leftWallWidth, 0);
      canvas.skew(0, -WALL_SLOPE);
      drawCover(canvas, leftWall, Skia.XYWHRect(0, leftWallWidth * WALL_SLOPE, leftWallWidth, WALL_HEIGHT));
      canvas.restore();
    }
    if (rightWall) {
      canvas.save();
      canvas.translate(origin.x, 0);
      canvas.skew(0, WALL_SLOPE);
      drawCover(canvas, rightWall, Skia.XYWHRect(0, 0, rightWallWidth, WALL_HEIGHT));
      canvas.restore();
    }

    // One floor image over the floor's bounding box; drawn after the walls so it masks their bottoms.
    if (floor) {
      drawCover(canvas, floor, Skia.XYWHRect(
        origin.x - roomY * (TILE_W / 2),
        origin.y,
        (roomX + roomY) * (TILE_W / 2),
        (roomX + roomY) * (TILE_H / 2),
      ));
    }

    drawDoors(canvas, scene.doors ?? [], origin);
  }), [leftWall, rightWall, floor, roomX, roomY, origin, scene.doors]);

  return <Picture picture={picture} />;
}
