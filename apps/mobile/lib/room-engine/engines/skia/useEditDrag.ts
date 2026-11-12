import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  measure,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
  type FrameInfo,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  TILE_H,
  TILE_W,
  WALL_ROWS,
  getEffectiveDimensions,
  roomCorner,
  screenToGrid,
  wallSideOf,
  type GridOrigin,
  type WallSide,
} from '@/constants/grid';
import { ItemPlacement, type Dimensions, type RoomItem } from '@chat-app/shared-types';
import type { EditLink, DragTarget, EditDrag } from '../../core/contract';
import { itemDepth, itemRect } from './geometry';
import { clampTo, offsetRange, visibleHeight, type CameraRig } from './useCamera';

/** How long a placed item is held before it lifts, like a home-screen widget. */
const LIFT_MS = 300;
/**
 * The target is read this far above the finger, in screen pixels, so the cells it lands
 * on show above the fingertip instead of under it.
 */
const FINGER_LIFT = 36;
/** Within this many pixels of the room's edge, a drag pans the camera that way. */
const EDGE = 56;
/** Camera pan speed at the very edge, in pixels per second. */
const EDGE_PAN_SPEED = 700;

/** The dragged item's shape on its surface, and where the finger holds it. */
interface DragShape {
  surface: 'floor' | 'wall';
  /** Footprint cells along x and y on the floor; columns and rows on a wall. */
  w: number;
  h: number;
  /** The finger's cell less the item's anchor, so it keeps its place under the finger. */
  grabX: number;
  grabY: number;
}

/** A placed item that can be lifted, for hit-testing on the UI thread. */
interface LiftTarget {
  rect: [number, number, number, number];
  surface: 'floor' | 'wall';
  wall: WallSide;
  w: number;
  h: number;
  /** Its anchor: grid x and y on the floor, column and row on its wall. */
  a: number;
  b: number;
}

function shapeOf(ri: RoomItem): Omit<LiftTarget, 'rect'> {
  const { dimensions, placement } = ri.itemId;
  if (placement === ItemPlacement.WALL) {
    const wall = wallSideOf(ri.orientation);
    return {
      surface: 'wall',
      wall,
      w: Math.max(1, dimensions.x),
      h: Math.max(1, dimensions.z),
      a: wall === 'right' ? ri.position.x : ri.position.y,
      b: ri.position.z,
    };
  }
  const dims = getEffectiveDimensions(dimensions, ri.orientation);
  return { surface: 'floor', wall: 'right', w: dims.x, h: dims.y, a: ri.position.x, b: ri.position.y };
}

/**
 * The cell under a content point: grid x and y on the floor (cells are centred on grid
 * vertices, so rounded), or column and row along `wall` (see wallCellAt). Not bounded.
 */
function cellUnder(surface: 'floor' | 'wall', wall: WallSide, x: number, y: number, origin: GridOrigin) {
  'worklet';
  if (surface === 'floor') {
    const g = screenToGrid(x, y, origin);
    return { a: Math.round(g.gx), b: Math.round(g.gy) };
  }
  const corner = roomCorner(origin);
  const along = (wall === 'right' ? x - corner.x : corner.x - x) / (TILE_W / 2);
  const up = (corner.y + Math.abs(along) * (TILE_H / 2) - y) / TILE_H;
  return { a: Math.floor(along), b: Math.floor(up) };
}

/**
 * How hard a finger `d` pixels from an edge pushes the camera that way: 0 outside EDGE, up
 * to 1 at the edge. At module scope with a directive: the React Compiler hoists capture-free
 * lambdas out of worklets into plain functions, which the UI thread can't call (ROOM_ENGINE.md).
 */
function edgePush(d: number) {
  'worklet';
  return Math.min(1, Math.max(0, (EDGE - d) / EDGE));
}

/** Index of the front-most lift target whose art contains the content point, or -1. */
function targetAt(list: readonly LiftTarget[], x: number, y: number) {
  'worklet';
  for (let i = 0; i < list.length; i++) {
    const r = list[i].rect;
    if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return i;
  }
  return -1;
}

function clampInt(v: number, lo: number, hi: number) {
  'worklet';
  return Math.min(Math.max(lo, hi), Math.max(lo, v));
}

interface Options {
  enabled: boolean;
  link: EditLink;
  rig: CameraRig;
  origin: GridOrigin;
  dimensions: Dimensions;
  /** The items drawn now; any can be lifted while nothing is being dragged. */
  items: readonly RoomItem[];
  drag: EditDrag | null;
  /** The picked-up item, whose place on screen goes to `link.selection` for its menu. */
  selected: RoomItem | null;
  /** The view the canvas fills, to map window coordinates into it. */
  viewRef: AnimatedRef<View>;
  onLift(item: RoomItem): void;
  onDragOver(target: DragTarget): void;
  onDrop(): void;
}

/**
 * Edit-mode drag and drop for the Skia engine. A long press on a placed item lifts it
 * (the returned gesture); then, for that drag and for one from the inventory alike, each
 * frame maps the finger in `link.pointer` to the cell the item would be anchored on,
 * clamped so it stays on its surface, and reports changes. Under the room is the
 * inventory drawer (`'away'`). Near the room's edges the camera pans along. Every frame
 * it also puts the picked-up item's place on screen in `link.selection`, for its menu.
 */
export function useEditDrag({
  enabled, link, rig, origin, dimensions, items, drag, selected, viewRef, onLift, onDragOver, onDrop,
}: Options) {
  const { camera, bounds, inset, width, height } = rig;
  const { pointer, selection } = link;
  // The picked-up item's art, in content pixels.
  const selectedRect = useSharedValue<[number, number, number, number] | null>(null);
  const shape = useSharedValue<DragShape | null>(null);
  const targets = useSharedValue<LiftTarget[]>([]);
  const pressed = useSharedValue(-1);
  const lifting = useSharedValue(false);
  const tracking = useSharedValue(false);
  const view = useSharedValue({ x: 0, y: 0 });
  const lastKey = useSharedValue('');

  // The worklets call stable functions that forward to the latest callbacks.
  const latest = useRef({ onLift, onDragOver, onDrop, liftable: [] as RoomItem[] });
  useEffect(() => {
    latest.current.onLift = onLift;
    latest.current.onDragOver = onDragOver;
    latest.current.onDrop = onDrop;
  });
  const [forward] = useState(() => ({
    lift: (i: number) => {
      const item = latest.current.liftable[i];
      if (item) latest.current.onLift(item);
    },
    over: (target: DragTarget) => latest.current.onDragOver(target),
    drop: () => latest.current.onDrop(),
  }));

  // What can be lifted, front to back, while nothing is being dragged.
  useEffect(() => {
    const liftable = enabled && !drag ? [...items].sort((a, b) => itemDepth(b) - itemDepth(a)) : [];
    latest.current.liftable = liftable;
    targets.set(liftable.map(ri => {
      const r = itemRect(ri, origin);
      return { rect: [r.x, r.y, r.width, r.height], ...shapeOf(ri) };
    }));
  }, [enabled, drag, items, origin, targets]);

  // The menu follows the picked-up item. Hidden at once on a change, so it never shows
  // at the last item's place for a frame.
  useEffect(() => {
    const r = enabled && selected && !drag ? itemRect(selected, origin) : null;
    selectedRect.set(r && [r.x, r.y, r.width, r.height]);
    selection.set({ ...selection.get(), visible: false });
  }, [enabled, selected, drag, origin, selectedRect, selection]);

  // A new copy from the inventory is held by its middle.
  const inventoryItem = drag?.source === 'inventory' ? drag.item : null;
  useEffect(() => {
    if (!inventoryItem) return;
    const s = shapeOf(inventoryItem);
    shape.set({ surface: s.surface, w: s.w, h: s.h, grabX: Math.floor(s.w / 2), grabY: Math.floor(s.h / 2) });
  }, [inventoryItem, shape]);

  const lift = useMemo(() => {
    const toContent = (x: number, y: number) => {
      'worklet';
      const s = camera.scale.get();
      return { x: (x - camera.tx.get()) / s, y: (y - camera.ty.get()) / s };
    };
    return Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      .activateAfterLongPress(LIFT_MS)
      .onTouchesDown((e, manager) => {
        const touch = e.allTouches[0];
        if (!touch) return;
        const p = toContent(touch.x, touch.y);
        const i = targetAt(targets.get(), p.x, p.y);
        // Not on an item: leave the touch to the camera and the tap.
        if (i < 0) manager.fail();
        else pressed.set(i);
      })
      .onStart(e => {
        const t = targets.get()[pressed.get()];
        if (!t) return;
        const p = toContent(e.x, e.y - FINGER_LIFT);
        const c = cellUnder(t.surface, t.wall, p.x, p.y, origin);
        shape.set({ surface: t.surface, w: t.w, h: t.h, grabX: c.a - t.a, grabY: c.b - t.b });
        lifting.set(true);
        pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
        scheduleOnRN(forward.lift, pressed.get());
      })
      .onUpdate(e => {
        if (lifting.get()) pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
      })
      .onFinalize(() => {
        if (!lifting.get()) return;
        lifting.set(false);
        pointer.set({ ...pointer.get(), active: false });
        scheduleOnRN(forward.drop);
      });
  }, [enabled, origin, camera, targets, pressed, shape, lifting, pointer, forward]);

  const dimX = dimensions.x;
  const dimY = dimensions.y;
  // Memoised: useFrameCallback registers the callback again whenever it changes.
  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    const sel = selectedRect.get();
    if (sel) {
      const m = measure(viewRef);
      if (m) {
        const scale = camera.scale.get();
        const left = m.pageX + camera.tx.get() + sel[0] * scale;
        const top = m.pageY + camera.ty.get() + sel[1] * scale;
        const bottom = top + sel[3] * scale;
        const right = left + sel[2] * scale;
        const vh = visibleHeight(height, inset.get());
        selection.set({
          x: (left + right) / 2,
          top,
          bottom,
          visible: right > m.pageX && left < m.pageX + width && bottom > m.pageY && top < m.pageY + vh,
        });
      }
    } else if (selection.get().visible) {
      selection.set({ ...selection.get(), visible: false });
    }

    const p = pointer.get();
    if (!p.active) {
      if (tracking.get()) {
        tracking.set(false);
        lastKey.set('');
        shape.set(null);
      }
      return;
    }
    if (!tracking.get()) {
      const m = measure(viewRef);
      if (!m) return;
      view.set({ x: m.pageX, y: m.pageY });
      tracking.set(true);
      cancelAnimation(camera.tx);
      cancelAnimation(camera.ty);
    }
    const s = shape.get();
    if (!s) return;
    const v = view.get();
    const lx = p.x - v.x;
    const ly = p.y - v.y;
    const vh = visibleHeight(height, inset.get());
    const inside = lx >= 0 && lx <= width && ly >= 0 && ly <= vh;

    // Near an edge, the camera pans to show more of the room that way.
    if (inside) {
      const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 50) / 1000;
      const dx = edgePush(lx) - edgePush(width - lx);
      const dy = edgePush(ly) - edgePush(vh - ly);
      if (dx !== 0 || dy !== 0) {
        const scale = camera.scale.get();
        const b = bounds.get();
        camera.tx.set(clampTo(camera.tx.get() + dx * EDGE_PAN_SPEED * dt, offsetRange(b.minX, b.maxX, scale, width)));
        camera.ty.set(clampTo(camera.ty.get() + dy * EDGE_PAN_SPEED * dt, offsetRange(b.minY, b.maxY, scale, vh)));
      }
    }

    let target: DragTarget = null;
    if (ly > vh && lx >= 0 && lx <= width) {
      target = 'away';
    } else if (inside) {
      const scale = camera.scale.get();
      const x = (lx - camera.tx.get()) / scale;
      const y = (ly - FINGER_LIFT - camera.ty.get()) / scale;
      if (s.surface === 'floor') {
        const c = cellUnder('floor', 'right', x, y, origin);
        target = {
          surface: 'floor',
          gx: clampInt(c.a - s.grabX, 0, dimX - s.w),
          gy: clampInt(c.b - s.grabY, 0, dimY - s.h),
        };
      } else {
        const wall: WallSide = x >= roomCorner(origin).x ? 'right' : 'left';
        const c = cellUnder('wall', wall, x, y, origin);
        const length = wall === 'right' ? dimX : dimY;
        target = {
          surface: 'wall',
          wall,
          col: clampInt(c.a - s.grabX, 0, length - s.w),
          row: clampInt(c.b - s.grabY, 0, WALL_ROWS - s.h),
        };
      }
    }
    const key = target === null || target === 'away'
      ? String(target)
      : target.surface === 'floor' ? `f${target.gx},${target.gy}` : `w${target.wall}${target.col},${target.row}`;
    if (key !== lastKey.get()) {
      lastKey.set(key);
      scheduleOnRN(forward.over, target);
    }
  }, [selectedRect, selection, pointer, tracking, lastKey, shape, viewRef, view, camera, height, width, inset, bounds, origin, dimX, dimY, forward]);
  const frameCallback = useFrameCallback(onFrame, false);
  useEffect(() => {
    frameCallback.setActive(enabled);
  }, [enabled, frameCallback]);

  return { liftGesture: lift };
}
