import { ReactNativeZoomableView, type ZoomableViewEvent } from '@openspacelabs/react-native-zoomable-view';
import { useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, View } from 'react-native';

import { computeOrigin, screenToGrid } from '@/constants/grid';
import type { RoomItem } from '@chat-app/shared-types';
import type { ActorState, RoomRendererProps } from '../../core/contract';
import Character from './Character';
import { GridOverlay } from './GridOverlay';
import { RoomBackdrop } from './RoomBackdrop';
import { RoomItemView } from './RoomItemView';

/** View-based isometric renderer: absolutely positioned RN views inside a zoomable canvas. */
export function LegacyRoomRenderer({
  scene,
  actors,
  mode,
  edit,
  onFloorTap,
  onItemTap,
  onCellTap,
  onActionComplete,
}: RoomRendererProps) {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<View>(null);
  const canvasPageOffset = useRef({ x: 0, y: 0 });

  const isEditMode = mode === 'edit';

  const origin = canvasSize.width > 0
    ? computeOrigin(canvasSize.width, scene.dimensions)
    : { x: 0, y: 0 };

  function handleRoomTap(event: GestureResponderEvent, zoomableViewEvent: ZoomableViewEvent) {
    if (isEditMode) return;

    const { zoomLevel, offsetX, offsetY } = zoomableViewEvent;
    // Use pageX/Y (absolute screen coords) minus the canvas's measured screen position.
    // locationX/Y from the ZoomableView's onSingleTap can be unreliable on Android
    // (new arch PanResponder may report coords in a different space), while pageX/Y is always
    // absolute and canvas offset is measured via measureInWindow.
    const tapX = event.nativeEvent.pageX - canvasPageOffset.current.x;
    const tapY = event.nativeEvent.pageY - canvasPageOffset.current.y;
    const contentX = (tapX - offsetX) / zoomLevel;
    const contentY = (tapY - offsetY) / zoomLevel;

    onFloorTap(screenToGrid(contentX, contentY, origin));
  }

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
      // Measure absolute screen position so handleRoomTap can convert pageX/Y to canvas coords.
      canvasRef.current?.measureInWindow((x, y) => {
        canvasPageOffset.current = { x, y };
      });
    }
  };

  // Unified depth-sorted renderable list (painter's algorithm)
  type Renderable =
    | { kind: 'character'; data: ActorState; depth: number }
    | { kind: 'item'; data: RoomItem; depth: number };

  const renderables: Renderable[] = [
    ...Object.values(actors).map(a => ({
      kind: 'character' as const,
      data: a,
      // +0.5 ensures characters render in front of floor items at the same tile
      depth: a.position.x + a.position.y + 0.5,
    })),
    ...scene.items.map(ri => ({
      kind: 'item' as const,
      data: ri,
      // Use item center so large multi-tile items sort in front of items behind them
      depth: ri.position.x + ri.position.y
        + ri.itemId.dimensions.x / 2
        + ri.itemId.dimensions.y / 2,
    })),
  ].sort((a, b) => a.depth - b.depth);

  return (
    <View ref={canvasRef} style={{ flex: 1 }} onLayout={onCanvasLayout}>
      {canvasSize.width > 0 && (
        <ReactNativeZoomableView
          style={{ width: canvasSize.width, height: canvasSize.height }}
          maxZoom={1.5}
          minZoom={0.5}
          zoomStep={0.5}
          initialZoom={1}
          bindToBorders={true}
          onSingleTap={handleRoomTap}
        >
          <View style={{ width: canvasSize.width, height: canvasSize.height }}>
            <RoomBackdrop
              roomDetails={scene}
              canvasWidth={canvasSize.width}
              canvasHeight={canvasSize.height}
            />

            {renderables.map(r =>
              r.kind === 'character' ? (
                <Character
                  key={`char-${r.data.id}`}
                  actor={r.data}
                  origin={origin}
                  onActionComplete={onActionComplete}
                />
              ) : (
                <RoomItemView
                  key={`item-${r.data.itemId._id}-${r.data.position.x}-${r.data.position.y}`}
                  roomItem={r.data}
                  origin={origin}
                  onActionPress={isEditMode ? undefined : onItemTap}
                  isSelectedInEditMode={isEditMode && edit.selectedPlaced === r.data}
                />
              ),
            )}

            {isEditMode && (
              <GridOverlay
                roomDimensions={scene.dimensions}
                origin={origin}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                pendingItems={scene.items}
                selectedItem={edit.selectedItem}
                onCellPress={(gx, gy) => onCellTap({ gx, gy })}
              />
            )}
          </View>
        </ReactNativeZoomableView>
      )}
    </View>
  );
}
