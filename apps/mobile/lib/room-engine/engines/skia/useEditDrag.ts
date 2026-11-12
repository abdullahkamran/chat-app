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

/**
 * A long press on a placed item, like on a home-screen widget: held this long without
 * moving, it is picked up and its menu opens. Moving on from there drags it. 400 ms is
 * Android's default long-press timeout (ViewConfiguration.DEFAULT_LONG_PRESS_TIMEOUT).
 */
const LONG_PRESS_MS = 400;
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
 * A content point in units along `wall` from the corner and up from the floor, unrounded:
 * wall cell (col, row) spans col..col + 1 and row..row + 1 (see wallCellAt).
 *
 * Must stay above cellUnder: the worklets plugin turns each worklet into a value made in
 * place, capturing what it calls right then, so a worklet declared further down is
 * missing on the UI thread and calling it crashes the app (a long press on a wall item did).
 */
function onWall(wall: WallSide, x: number, y: number, origin: GridOrigin) {
  'worklet';
  const corner = roomCorner(origin);
  const along = (wall === 'right' ? x - corner.x : corner.x - x) / (TILE_W / 2);
  const up = (corner.y + Math.abs(along) * (TILE_H / 2) - y) / TILE_H;
  return { along, up };
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
  const w = onWall(wall, x, y, origin);
  return { a: Math.floor(w.along), b: Math.floor(w.up) };
}

/** Clamps into lo..hi, or to lo when hi < lo (an item bigger than its surface). */
function clampFloat(v: number, lo: number, hi: number) {
  'worklet';
  return Math.min(Math.max(lo, hi), Math.max(lo, v));
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
  onItemMenu(item: RoomItem): void;
  onDragOver(target: DragTarget): void;
  onDrop(): void;
}

/** Movement, in screen pixels, after which a held item counts as dragged. */
const TOUCH_SLOP = 8;

/**
 * A long press on a placed item. `phase`: 0 none, 1 its menu is open (the press held still),
 * 2 dragging (the finger moved past TOUCH_SLOP from `x`, `y`, where the press landed).
 * `shape` is taken at the press, for the drag.
 */
interface Hold {
  phase: 0 | 1 | 2;
  x: number;
  y: number;
  shape: DragShape | null;
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
  enabled, link, rig, origin, dimensions, items, drag, selected, viewRef, onLift, onItemMenu, onDragOver, onDrop,
}: Options) {
  const { camera, bounds, inset, width, height } = rig;
  const { pointer, selection } = link;
  // The picked-up item's art, in content pixels.
  const selectedRect = useSharedValue<[number, number, number, number] | null>(null);
  const shape = useSharedValue<DragShape | null>(null);
  const targets = useSharedValue<LiftTarget[]>([]);
  const pressed = useSharedValue(-1);
  const tracking = useSharedValue(false);
  const view = useSharedValue({ x: 0, y: 0 });
  const lastKey = useSharedValue('');
  const hold = useSharedValue<Hold>({ phase: 0, x: 0, y: 0, shape: null });
  /**
   * Where the dragged item's anchor is under the finger, in grid units and unrounded
   * (x, y, z as in RoomItem.position), so it is drawn following the finger smoothly while
   * it snaps to whole cells. `active` while it is over the room.
   */
  const dragFree = useSharedValue({ x: 0, y: 0, z: 0, active: false });

  // The worklets call stable functions that forward to the latest callbacks.
  const latest = useRef({
    onLift, onItemMenu, onDragOver, onDrop,
    liftable: [] as RoomItem[],
    /**
     * The long-pressed item. Kept here because `liftable` empties as soon as its drag starts,
     * and the drag and drop must not look it up by index.
     */
    held: null as RoomItem | null,
  });
  useEffect(() => {
    latest.current.onLift = onLift;
    latest.current.onItemMenu = onItemMenu;
    latest.current.onDragOver = onDragOver;
    latest.current.onDrop = onDrop;
  });
  const [forward] = useState(() => ({
    /** A long press: the item is picked up and its menu opens. */
    press: (i: number) => {
      const item = latest.current.liftable[i] ?? null;
      latest.current.held = item;
      if (item) latest.current.onItemMenu(item);
    },
    /** The finger moved on: the menu closes and the item is dragged. */
    lift: () => {
      const item = latest.current.held;
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
      .activateAfterLongPress(LONG_PRESS_MS)
      .onTouchesDown((e, manager) => {
        const touch = e.allTouches[0];
        if (!touch) return;
        const p = toContent(touch.x, touch.y);
        const i = targetAt(targets.get(), p.x, p.y);
        // Not on an item: leave the touch to the camera and the tap.
        if (i < 0) {
          manager.fail();
          return;
        }
        pressed.set(i);
      })
      .onStart(e => {
        // Held still for LONG_PRESS_MS: picked up, its menu open (one vibration, from the session).
        const t = targets.get()[pressed.get()];
        if (!t) return;
        const p = toContent(e.x, e.y - FINGER_LIFT);
        const c = cellUnder(t.surface, t.wall, p.x, p.y, origin);
        const held: DragShape = { surface: t.surface, w: t.w, h: t.h, grabX: c.a - t.a, grabY: c.b - t.b };
        hold.set({ phase: 1, x: e.absoluteX, y: e.absoluteY, shape: held });
        scheduleOnRN(forward.press, pressed.get());
      })
      .onUpdate(e => {
        const h = hold.get();
        if (h.phase === 2) {
          pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
        } else if (h.phase === 1 && Math.hypot(e.absoluteX - h.x, e.absoluteY - h.y) > TOUCH_SLOP) {
          // Moved on from the long press: the menu closes and the item follows the finger.
          shape.set(h.shape);
          hold.set({ ...h, phase: 2 });
          pointer.set({ x: e.absoluteX, y: e.absoluteY, active: true });
          scheduleOnRN(forward.lift);
        }
      })
      .onFinalize(() => {
        const phase = hold.get().phase;
        hold.set({ ...hold.get(), phase: 0 });
        pressed.set(-1);
        // Let go with the menu open: it stays open. Let go dragging: the item drops.
        if (phase !== 2) return;
        pointer.set({ ...pointer.get(), active: false });
        scheduleOnRN(forward.drop);
      });
  }, [enabled, origin, camera, targets, pressed, hold, shape, pointer, forward]);

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
        dragFree.set({ ...dragFree.get(), active: false });
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
      // The anchor follows the finger unrounded, kept on its surface; the target is the
      // whole cell nearest it, where the item lands when let go.
      if (s.surface === 'floor') {
        const g = screenToGrid(x, y, origin);
        const fx = clampFloat(g.gx - s.grabX, 0, dimX - s.w);
        const fy = clampFloat(g.gy - s.grabY, 0, dimY - s.h);
        dragFree.set({ x: fx, y: fy, z: 0, active: true });
        target = { surface: 'floor', gx: Math.round(fx), gy: Math.round(fy) };
      } else {
        const wall: WallSide = x >= roomCorner(origin).x ? 'right' : 'left';
        const w = onWall(wall, x, y, origin);
        const length = wall === 'right' ? dimX : dimY;
        // Cell col spans col..col + 1, so the cell the finger is in is the nearest to along - 0.5.
        const col = clampFloat(w.along - 0.5 - s.grabX, 0, length - s.w);
        const row = clampFloat(w.up - 0.5 - s.grabY, 0, WALL_ROWS - s.h);
        dragFree.set(wall === 'right'
          ? { x: col, y: 0, z: row, active: true }
          : { x: 0, y: col, z: row, active: true });
        target = { surface: 'wall', wall, col: Math.round(col), row: Math.round(row) };
      }
    } else if (dragFree.get().active) {
      dragFree.set({ ...dragFree.get(), active: false });
    }
    const key = target === null || target === 'away'
      ? String(target)
      : target.surface === 'floor' ? `f${target.gx},${target.gy}` : `w${target.wall}${target.col},${target.row}`;
    if (key !== lastKey.get()) {
      lastKey.set(key);
      scheduleOnRN(forward.over, target);
    }
  }, [selectedRect, selection, dragFree, pointer, tracking, lastKey, shape, viewRef, view, camera, height, width, inset, bounds, origin, dimX, dimY, forward]);
  const frameCallback = useFrameCallback(onFrame, false);
  useEffect(() => {
    frameCallback.setActive(enabled);
  }, [enabled, frameCallback]);

  return { liftGesture: lift, dragFree };
}
