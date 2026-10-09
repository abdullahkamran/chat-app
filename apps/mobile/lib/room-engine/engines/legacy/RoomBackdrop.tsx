import { Image } from 'expo-image';
import { Image as RNImage, StyleSheet, View } from 'react-native';
import Svg, { Image as SvgImage } from 'react-native-svg';

import { resolveItemSource } from '@/constants/avatarAssets';
import {
  TILE_H,
  TILE_W,
  WALL_HEIGHT,
  computeOrigin,
  gridToScreen,
  type GridOrigin,
} from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { Door, RoomDetails } from '@chat-app/shared-types';

type Props = {
  roomDetails?: Pick<RoomDetails, 'theme' | 'dimensions' | 'doors'> | null;
  canvasWidth: number;
  canvasHeight: number;
};

/**
 * Isometric skew angle for wall textures.
 * arctan(TILE_H / TILE_W) is the slope of the isometric grid axes in screen space,
 * which equals the angle each wall face must lean to align with the projection.
 * For 2:1 isometric (TILE_H = TILE_W/2): arctan(0.5) ≈ 26.565°
 *
 * Used as an SVG transform string (SVG skewY is a true shear on all platforms,
 * unlike the React Native native transform which rotates on Android).
 */
const WALL_SKEW_DEG = (Math.atan(TILE_H / TILE_W) * 180 / Math.PI).toFixed(4);

/** Vertical drop at the front-top corner of a wall of the given width (tan × width). */
const wallDrop = (width: number) => width * TILE_H / TILE_W;

/**
 * Isometric diamond tile indicator for a door position.
 * Uses rotate(45°) + scaleY(0.5) on a square of side TILE_W/√2 to produce
 * a 2:1 isometric rhombus that perfectly covers one floor tile.
 */
const DOOR_TILE_SIZE = TILE_W / Math.SQRT2; // ≈ 56.57 px

function DoorIndicator({ door, origin }: { door: Door; origin: GridOrigin }) {
  const { x: gx, y: gy } = door.position;
  const topCorner = gridToScreen(gx, gy, 0, origin);
  // Screen center of the tile (halfway between top and front corners)
  const cx = topCorner.x;
  const cy = topCorner.y + TILE_H / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: cx - DOOR_TILE_SIZE / 2,
        top: cy - DOOR_TILE_SIZE / 2,
        width: DOOR_TILE_SIZE,
        height: DOOR_TILE_SIZE,
        backgroundColor: door.isEntry
          ? 'rgba(255, 252, 0, 0.25)'
          : 'rgba(255, 255, 255, 0.15)',
        borderWidth: 2,
        borderColor: door.isEntry ? theme.colors.primary : theme.colors.border,
        transform: [{ scaleY: 0.5 }, { rotate: '45deg' }],
      }}
    />
  );
}

/**
 * Renders the isometric room backdrop:
 * - Two wall panels rendered via react-native-svg so skewY is a true shear on
 *   all platforms (Android's native transform skewY rotates instead of shearing).
 * - A single floor image covering the entire floor bounding box, drawn on top to mask wall bottoms.
 *
 * SVG geometry for each wall:
 *   The SVG is positioned at top=0 and sized to contain the full parallelogram.
 *   The SvgImage is offset so that after skewY the back-top corner lands at y=0.
 *
 *   Left wall (skewY(-θ)): image placed at y = drop, so TR corner (W, drop) → (W, 0).
 *   Right wall (skewY(+θ)): image placed at y = 0, so TL corner (0, 0) stays at (0, 0)
 *     and TR corner (W, 0) → (W, drop).
 */
export function RoomBackdrop({ roomDetails, canvasWidth, canvasHeight }: Props) {
  const leftWallRaw = resolveItemSource(roomDetails?.theme?.leftWall?.assetUrl ?? '');
  const rightWallRaw = resolveItemSource(roomDetails?.theme?.rightWall?.assetUrl ?? '');
  const floorSource = resolveItemSource(roomDetails?.theme?.floor?.assetUrl ?? '');

  // react-native-svg Image needs a URI string; convert require() module IDs.
  const leftWallUri = leftWallRaw ? RNImage.resolveAssetSource(leftWallRaw as number).uri : null;
  const rightWallUri = rightWallRaw ? RNImage.resolveAssetSource(rightWallRaw as number).uri : null;

  const roomX = roomDetails?.dimensions?.x || 8;
  const roomY = roomDetails?.dimensions?.y || 6;

  const origin = computeOrigin(canvasWidth, { x: roomX, y: roomY });

  // Bounding rectangle of the floor diamond — one image, no tiling
  const floorLeft = origin.x - roomY * (TILE_W / 2);
  const floorTop = origin.y;
  const floorWidth = (roomX + roomY) * (TILE_W / 2);
  const floorHeight = (roomX + roomY) * (TILE_H / 2);

  const leftWallWidth = roomY * (TILE_W / 2);
  const rightWallWidth = roomX * (TILE_W / 2);

  // origin.x is where both walls meet (the back corner of the room).
  const leftWallLeft = origin.x - leftWallWidth;
  const rightWallLeft = origin.x;

  // Vertical distance the front-top corner drops relative to the back-top corner.
  const leftDrop = wallDrop(leftWallWidth);
  const rightDrop = wallDrop(rightWallWidth);

  return (
    <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
      {/* Left wall — back-top corner at (origin.x, 0); image offset down by leftDrop then skewed up */}
      <Svg
        style={{ position: 'absolute', left: leftWallLeft, top: 0 }}
        width={leftWallWidth}
        height={WALL_HEIGHT + leftDrop}
      >
        <SvgImage
          href={leftWallUri ?? undefined}
          x={0}
          y={leftDrop}
          width={leftWallWidth}
          height={WALL_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
          transform={`skewY(${-WALL_SKEW_DEG})`}
        />
      </Svg>

      {/* Right wall — back-top corner at (origin.x, 0); image skewed so right side drops down */}
      <Svg
        style={{ position: 'absolute', left: rightWallLeft, top: 0 }}
        width={rightWallWidth}
        height={WALL_HEIGHT + rightDrop}
      >
        <SvgImage
          href={rightWallUri ?? undefined}
          x={0}
          y={0}
          width={rightWallWidth}
          height={WALL_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
          transform={`skewY(${WALL_SKEW_DEG})`}
        />
      </Svg>

      {/* Single floor image — covers the full floor bounding box, sits on top of wall bottoms */}
      <Image
        source={floorSource ?? undefined}
        style={{
          position: 'absolute',
          left: floorLeft,
          top: floorTop,
          width: floorWidth,
          height: floorHeight,
        }}
        contentFit="cover"
      />

      {/* Door indicators rendered on top of the floor */}
      {roomDetails?.doors?.map((door, i) => (
        <DoorIndicator key={i} door={door} origin={origin} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
