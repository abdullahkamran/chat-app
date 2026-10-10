import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { computeOrigin, screenToGrid } from '@/constants/grid';
import type { RoomRendererProps } from '../../core/contract';
import { ActorOverlay } from './ActorOverlay';
import { Backdrop } from './Backdrop';
import { EditGrid } from './EditGrid';
import { useActorMotions } from './actorMotion';
import { cellAt, hitTestItems } from './geometry';
import { preloadSkImages, useSkImages } from './imageCache';
import { useCamera } from './useCamera';
import { useStressActors } from './useStressActors';
import { useWorldPicture } from './useWorldPicture';

/**
 * Skia renderer. Layers, back to front:
 *   backdrop (SkPicture, static) → world (SkPicture, every frame) → edit grid   [inside the canvas]
 *   chat bubbles                                                               [RN views over the canvas]
 * The world is items and skeletal avatars, depth-sorted on the UI thread. The camera
 * is a shared-value transform on the root group; taps are mapped back through it to
 * grid coordinates.
 */
export function SkiaRoomRenderer(props: RoomRendererProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { theme, items } = props.scene;

  // Start decoding before the first layout pass so the backdrop is ready sooner.
  useEffect(() => {
    preloadSkImages([
      theme?.floor?.assetUrl,
      theme?.leftWall?.assetUrl,
      theme?.rightWall?.assetUrl,
      ...items.map(ri => ri.itemId.assetUrl),
    ]);
  }, [theme, items]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  };

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {size.width > 0 && <Room {...props} width={size.width} height={size.height} />}
    </View>
  );
}

function Room({
  scene,
  actors: sessionActors,
  localActorId,
  mode,
  edit,
  onFloorTap,
  onItemTap,
  onCellTap,
  onActionComplete: sessionOnActionComplete,
  width,
  height,
}: RoomRendererProps & { width: number; height: number }) {
  const origin = useMemo(() => computeOrigin(width, scene.dimensions), [width, scene.dimensions]);
  const isEditMode = mode === 'edit';
  const { actors, onActionComplete } = useStressActors(sessionActors, scene.dimensions, sessionOnActionComplete);

  // Taps arrive in content coordinates (the camera is already undone).
  const handleTap = (x: number, y: number) => {
    const point = screenToGrid(x, y, origin);

    if (isEditMode) {
      const cell = cellAt(point.gx, point.gy, scene.dimensions);
      if (cell) onCellTap(cell);
      return;
    }

    const item = hitTestItems(scene.items, { x, y }, origin);
    if (item) onItemTap(item);
    else onFloorTap(point);
  };

  const { camera, transform, gesture } = useCamera(width, height, handleTap);
  const motions = useActorMotions(actors);
  const itemImages = useSkImages(scene.items.map(ri => ri.itemId.assetUrl));
  const world = useWorldPicture({
    actors,
    motions,
    localActorId,
    items: scene.items,
    itemImages,
    selectedPlaced: isEditMode ? edit.selectedPlaced : null,
    origin,
  });

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height }}>
          <Group transform={transform}>
            <Backdrop scene={scene} origin={origin} />
            <Picture picture={world} />
            {isEditMode && <EditGrid dimensions={scene.dimensions} origin={origin} />}
          </Group>
        </Canvas>
      </GestureDetector>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Object.values(actors).map(a => {
          const motion = motions.get(a.id);
          return motion && (
            <ActorOverlay
              key={a.id}
              actor={a}
              motion={motion}
              camera={camera}
              origin={origin}
              canvasHeight={height}
              onActionComplete={onActionComplete}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
