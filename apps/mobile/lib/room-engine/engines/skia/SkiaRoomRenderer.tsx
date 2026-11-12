import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { computeOrigin, screenToGrid } from '@/constants/grid';
import { ItemPlacement, type RoomItem } from '@chat-app/shared-types';
import { sendCameraCommand } from '../../core/camera';
import type { EditCell, RoomRendererProps } from '../../core/contract';
import { ActorOverlay } from './ActorOverlay';
import { Backdrop } from './Backdrop';
import { DEBUG_CELL_MAP, DEBUG_OCCUPANCY, DebugOverlay } from './DebugOverlay';
import { EditGrid } from './EditGrid';
import { useSteerDriver } from '../../joystick/useSteerDriver';
import { DEFAULT_MS_PER_CELL, useActorMotions } from './actorMotion';
import { cellAt, hitTestActors, hitTestItems, roomContentBounds, wallCellAt } from './geometry';
import { preloadSkImages, useSkImages } from './imageCache';
import { AVATAR_HEIGHT } from './skeleton/humanoidV1';
import { loadZoom, saveZoom } from './cameraPrefs';
import { OffscreenPointers } from './OffscreenPointers';
import { useCamera, useCameraState } from './useCamera';
import { useCameraDirector } from './useCameraDirector';
import { useStressActors } from './useStressActors';
import { useWorldPicture } from './useWorldPicture';
import { useAvatarArts } from './wearables/useAvatarArts';

/**
 * Skia renderer. Layers, back to front:
 *   backdrop (SkPicture, static) → world (SkPicture, every frame) → edit grid   [inside the canvas]
 *   chat bubbles                                                               [RN views over the canvas]
 * The world is items and skeletal avatars, depth-sorted on the UI thread. The camera
 * is a shared-value transform on the root group; taps are mapped back through it to
 * grid coordinates. useCameraDirector moves it on its own (following the local actor,
 * framing everyone, showing someone); panning hands it to the user until they walk again.
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
      ...items.flatMap(itemAssetUrls),
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
  effects,
  onActorTap,
  onFloorTap,
  onItemTap,
  onCellTap,
  onActionComplete: sessionOnActionComplete,
  steering,
  camera: cameraLink,
  width,
  height,
}: RoomRendererProps & { width: number; height: number }) {
  const origin = useMemo(() => computeOrigin(width, scene.dimensions), [width, scene.dimensions]);
  const isEditMode = mode === 'edit';
  const { actors, onActionComplete } = useStressActors(sessionActors, scene.dimensions, sessionOnActionComplete);
  const motions = useActorMotions(actors);
  // Experimental joystick (joystick/): moves the local actor while the stick is pushed.
  const steered = useSteerDriver({
    steering,
    motion: motions.get(localActorId),
    dimensions: scene.dimensions,
    items: scene.items,
    msPerCell: actors[localActorId]?.user?.attributes?.speed ?? DEFAULT_MS_PER_CELL,
  });

  // Camera mode, zoom and recentring, shared by the gestures and the director. With Reduce
  // Motion the room opens on the local actor instead of gliding there from an overview.
  const reduceMotion = useReducedMotion();
  const cameraState = useCameraState(reduceMotion ? 'follow' : 'intro');
  // Walking takes the camera back to the local actor, unless it is framing everyone.
  const resumeFollow = useCallback(() => {
    const m = cameraState.mode.get();
    if (m === 'free' || m === 'focus') cameraState.mode.set('follow');
  }, [cameraState]);

  // Taps arrive in content coordinates (the camera is already undone).
  const handleTap = (x: number, y: number) => {
    const point = screenToGrid(x, y, origin);

    if (isEditMode) {
      const floor = cellAt(point.gx, point.gy, scene.dimensions);
      const wall = floor ? null : wallCellAt(x, y, origin, scene.dimensions);
      const cell: EditCell | null = floor ? { surface: 'floor', ...floor } : wall && { surface: 'wall', ...wall };
      const hit = hitTestItems(scene.items, { x, y }, origin, true);
      if (cell || hit) onCellTap(cell, hit);
      return;
    }

    const actorId = hitTestActors(motions, { x, y }, origin, AVATAR_HEIGHT);
    if (actorId && onActorTap(actorId)) return;
    resumeFollow();
    const item = hitTestItems(scene.items, { x, y }, origin);
    if (item) onItemTap(item);
    else onFloorTap(point);
  };

  const bounds = useMemo(() => roomContentBounds(origin, scene.dimensions), [origin, scene.dimensions]);
  const { camera, rig, transform, gesture } = useCamera({
    width, height, contentBounds: bounds, state: cameraState, inset: cameraLink.bottomInset, onTap: handleTap, onZoom: saveZoom,
  });
  const directed = useMemo(() => [...motions].map(([id, motion]) => ({ id, motion })), [motions]);
  useCameraDirector({ rig, actors: directed, localActorId, origin, link: cameraLink, reduceMotion });
  // The zoom the user last pinched to, from an earlier visit.
  useEffect(() => {
    let live = true;
    loadZoom().then(z => {
      if (live && z !== null) cameraState.zoom.set(z);
    });
    return () => {
      live = false;
    };
  }, [cameraState]);
  // The joystick walks too, so it brings the camera back to the actor.
  useEffect(() => {
    if (steered) resumeFollow();
  }, [steered, resumeFollow]);
  // Rearranging the room is about the whole room, not the actor: the camera stays where the
  // user puts it, and comes back to them afterwards.
  const wasEditing = useRef(isEditMode);
  useEffect(() => {
    if (wasEditing.current === isEditMode) return;
    wasEditing.current = isEditMode;
    cameraState.mode.set(isEditMode ? 'free' : 'follow');
    if (!isEditMode) cameraState.recentre.set(true);
  }, [isEditMode, cameraState]);
  const focusActor = useCallback(
    (actorId: string) => sendCameraCommand(cameraLink, { kind: 'focus', actorId }),
    [cameraLink],
  );

  // The edit grid shows the wall cells while a wall item is chosen or picked up.
  const editPlacement = edit.selectedPlaced?.itemId.placement ?? edit.selectedItem?.placement;
  const editSurface = editPlacement === ItemPlacement.WALL ? 'wall' : 'floor';

  const itemImages = useSkImages(scene.items.flatMap(itemAssetUrls));
  const { arts, artKeys } = useAvatarArts(actors);
  const world = useWorldPicture({
    actors,
    motions,
    localActorId,
    items: scene.items,
    arts,
    artKeys,
    itemImages,
    selectedPlaced: isEditMode ? edit.selectedPlaced : null,
    origin,
    onActionComplete,
    effects,
    // Nobody shows while the room is being rearranged: someone seated on a chair being
    // moved would otherwise hang in the air until the layout is saved and stands them up.
    hideActors: isEditMode,
  });

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height }}>
          <Group transform={transform}>
            <Backdrop scene={scene} origin={origin} />
            <Picture picture={world} />
            {isEditMode && <EditGrid dimensions={scene.dimensions} origin={origin} surface={editSurface} />}
            {(DEBUG_OCCUPANCY || DEBUG_CELL_MAP) && (
              <DebugOverlay dimensions={scene.dimensions} items={scene.items} motions={motions} origin={origin} />
            )}
          </Group>
        </Canvas>
      </GestureDetector>

      {/* Bubbles hide with their avatars in edit mode, but stay mounted: they drive the walks. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, isEditMode && styles.hidden]}>
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
              steered={steered && a.id === localActorId}
            />
          );
        })}
      </View>
      {!isEditMode && (
        <OffscreenPointers
          actors={actors}
          localActorId={localActorId}
          motions={motions}
          rig={rig}
          origin={origin}
          onFocus={focusActor}
        />
      )}
    </View>
  );
}

/** An item's image and, for furniture drawn over a seated avatar, its front layer. */
function itemAssetUrls(ri: RoomItem): string[] {
  const { assetUrl, frontAssetUrl } = ri.itemId;
  return frontAssetUrl ? [assetUrl, frontAssetUrl] : [assetUrl];
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
});
