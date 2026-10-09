import { Canvas, Group } from '@shopify/react-native-skia';
import { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { computeOrigin, screenToGrid } from '@/constants/grid';
import type { RoomRendererProps } from '../../core/contract';
import { ActorCapsule } from './ActorCapsule';
import { ActorOverlay } from './ActorOverlay';
import { Backdrop } from './Backdrop';
import { EditGrid } from './EditGrid';
import { ItemSprite } from './ItemSprite';
import { useActorMotions } from './actorMotion';
import { actorDepth, cellAt, hitTestItems, itemDepth } from './geometry';
import { useCamera } from './useCamera';

/**
 * Skia renderer. Layers, back to front:
 *   backdrop (SkPicture) → items and actors, depth-sorted → edit grid   [inside the canvas]
 *   chat bubbles                                                        [RN views over the canvas]
 * The camera is a shared-value transform on the root group; taps are mapped back
 * through it to grid coordinates.
 */
export function SkiaRoomRenderer(props: RoomRendererProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

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
  actors,
  localActorId,
  mode,
  edit,
  onFloorTap,
  onItemTap,
  onCellTap,
  onActionComplete,
  width,
  height,
}: RoomRendererProps & { width: number; height: number }) {
  const origin = computeOrigin(width, scene.dimensions);
  const isEditMode = mode === 'edit';

  // Tap handling reads the latest props through a ref so the gesture isn't rebuilt every render.
  const latest = useRef({ scene, origin, isEditMode, onFloorTap, onItemTap, onCellTap });
  latest.current = { scene, origin, isEditMode, onFloorTap, onItemTap, onCellTap };

  const handleTap = useCallback((x: number, y: number) => {
    const { scene, origin, isEditMode, onFloorTap, onItemTap, onCellTap } = latest.current;
    const point = screenToGrid(x, y, origin);

    if (isEditMode) {
      const cell = cellAt(point.gx, point.gy, scene.dimensions);
      if (cell) onCellTap(cell);
      return;
    }

    const item = hitTestItems(scene.items, { x, y }, origin);
    if (item) onItemTap(item);
    else onFloorTap(point);
  }, []);

  const { camera, transform, gesture } = useCamera(width, height, handleTap);
  const motions = useActorMotions(actors);

  const actorList = Object.values(actors);
  const renderables = [
    ...actorList.map(a => ({ kind: 'actor' as const, data: a, depth: actorDepth(a) })),
    ...scene.items.map(ri => ({ kind: 'item' as const, data: ri, depth: itemDepth(ri) })),
  ].sort((a, b) => a.depth - b.depth);

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height }}>
          <Group transform={transform}>
            <Backdrop scene={scene} origin={origin} />
            {renderables.map(r =>
              r.kind === 'actor' ? (
                <ActorCapsule
                  key={`actor-${r.data.id}`}
                  actor={r.data}
                  motion={motions.get(r.data.id)!}
                  origin={origin}
                  isLocal={r.data.id === localActorId}
                />
              ) : (
                <ItemSprite
                  key={`item-${r.data.itemId._id}-${r.data.position.x}-${r.data.position.y}`}
                  roomItem={r.data}
                  origin={origin}
                  selected={isEditMode && edit.selectedPlaced === r.data}
                />
              ),
            )}
            {isEditMode && <EditGrid dimensions={scene.dimensions} origin={origin} />}
          </Group>
        </Canvas>
      </GestureDetector>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {actorList.map(a => (
          <ActorOverlay
            key={a.id}
            actor={a}
            motion={motions.get(a.id)!}
            camera={camera}
            origin={origin}
            canvasHeight={height}
            onActionComplete={onActionComplete}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
