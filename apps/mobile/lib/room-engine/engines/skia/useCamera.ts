import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { CameraMode } from '../../core/contract';
import type { ContentBounds } from './geometry';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
/** How far past MIN_ZOOM / MAX_ZOOM a pinch can stretch before it springs back, as a fraction. */
const ZOOM_STRETCH = 0.15;
/** Resistance when dragging past an edge (iOS uses 0.55): lower is stiffer. */
const RUBBER_BAND = 0.55;
/** Per-millisecond velocity kept by a fling; closer to 1 glides further. */
const FLING_DECELERATION = 0.997;
/** Springs back into bounds after a stretched pan or pinch. */
const SETTLE_SPRING = { damping: 26, stiffness: 260, mass: 1 };
/** The visible height never counts as less than this, so a tall keyboard can't collapse the maths. */
const MIN_VISIBLE_HEIGHT = 120;

export interface Camera {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

/** What the camera is doing, shared by the gestures and the director (useCameraDirector). */
export interface CameraState {
  mode: SharedValue<CameraMode>;
  /** The zoom the user picked by pinching; follow and focus use it. Remembered on the device. */
  zoom: SharedValue<number>;
  /** Glide the target right to the middle of the view instead of into the dead zone. */
  recentre: SharedValue<boolean>;
}

export function useCameraState(initialMode: CameraMode): CameraState {
  const mode = useSharedValue<CameraMode>(initialMode);
  const zoom = useSharedValue(1);
  const recentre = useSharedValue(false);
  return useMemo(() => ({ mode, zoom, recentre }), [mode, zoom, recentre]);
}

/** Camera state that the director steers by. */
export interface CameraRig extends CameraState {
  camera: Camera;
  /** True while a gesture or a fling or settle animation owns the camera; the director waits. */
  busy: SharedValue<boolean>;
  bounds: SharedValue<ContentBounds>;
  /** Pixels at the bottom hidden by the keyboard or the transcript. */
  inset: SharedValue<number>;
  width: number;
  height: number;
}

/** The height of the room not hidden by the keyboard or the transcript. */
export function visibleHeight(height: number, inset: number): number {
  'worklet';
  return Math.max(Math.min(height, MIN_VISIBLE_HEIGHT), height - inset);
}

/**
 * The camera offsets that keep the viewport inside the content: one value (centred) when
 * the scaled content is smaller than the viewport, else the range from edge to edge.
 */
export function offsetRange(min: number, max: number, scale: number, view: number): [number, number] {
  'worklet';
  const span = (max - min) * scale;
  if (span <= view) {
    const centred = (view - span) / 2 - min * scale;
    return [centred, centred];
  }
  return [view - max * scale, -min * scale];
}

export function clampTo(value: number, [lo, hi]: [number, number]): number {
  'worklet';
  return Math.min(hi, Math.max(lo, value));
}

export function clampZoom(scale: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Diminishing overshoot past an edge, like iOS scroll views: never more than `dim`. */
function rubber(over: number, dim: number): number {
  'worklet';
  return Math.sign(over) * (1 - 1 / ((Math.abs(over) * RUBBER_BAND) / dim + 1)) * dim;
}

function softClamp(value: number, [lo, hi]: [number, number], dim: number): number {
  'worklet';
  if (value < lo) return lo + rubber(value - lo, dim);
  if (value > hi) return hi + rubber(value - hi, dim);
  return value;
}

/** Pinching past the zoom limits stretches a little, with resistance. */
function softZoom(scale: number): number {
  'worklet';
  if (scale > MAX_ZOOM) return MAX_ZOOM * (1 + rubber(scale / MAX_ZOOM - 1, ZOOM_STRETCH));
  if (scale < MIN_ZOOM) return MIN_ZOOM * (1 + rubber(scale / MIN_ZOOM - 1, ZOOM_STRETCH));
  return scale;
}

interface Options {
  width: number;
  height: number;
  contentBounds: ContentBounds;
  state: CameraState;
  inset: SharedValue<number>;
  onTap: (contentX: number, contentY: number) => void;
  /** A pinch settled on a new zoom, to remember it. */
  onZoom: (zoom: number) => void;
}

/**
 * Pan and pinch camera driven entirely by shared values, plus a tap gesture that
 * reports taps in content (pre-camera) coordinates.
 *
 * screen = content * scale + (tx, ty)
 *
 * The camera stays over `contentBounds`, down to the bottom of the visible part of the
 * room. Dragging past an edge stretches with resistance, and letting go flings with
 * inertia and bounces back at the edges, like a scroll view. A touch during a fling stops
 * it without counting as a tap. Panning switches the camera to `free`; pinching sets the
 * remembered zoom and leaves follow and focus as they are.
 */
export function useCamera({ width, height, contentBounds, state, inset, onTap, onZoom }: Options) {
  const { mode, zoom } = state;
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const busy = useSharedValue(false);
  const bounds = useSharedValue(contentBounds);
  /** Running fling (decay) animations, one per axis. */
  const flinging = useSharedValue(0);
  /** Set when a touch stopped a fling, so lifting that finger isn't a tap. */
  const stoppedFling = useSharedValue(false);
  // Gesture start state. A shared value, not a closure object: each worklet gets its own copy of captured objects.
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0, focalX: 0, focalY: 0 });
  const focal = useSharedValue({ x: 0, y: 0 });

  useEffect(() => {
    bounds.set(contentBounds);
  }, [bounds, contentBounds]);

  const transform = useDerivedValue(() => [
    { translateX: tx.get() },
    { translateY: ty.get() },
    { scale: scale.get() },
  ]);

  const gesture = useMemo(() => {
    const rangeX = (s: number) => {
      'worklet';
      const b = bounds.get();
      return offsetRange(b.minX, b.maxX, s, width);
    };
    const rangeY = (s: number) => {
      'worklet';
      const b = bounds.get();
      return offsetRange(b.minY, b.maxY, s, visibleHeight(height, inset.get()));
    };
    const stopAll = () => {
      'worklet';
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
    };
    const settleDone = (finished?: boolean) => {
      'worklet';
      if (finished) busy.set(false);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        stopAll();
        busy.set(true);
        mode.set('free');
        start.set({ ...start.get(), tx: tx.get(), ty: ty.get() });
      })
      .onUpdate(e => {
        const s = scale.get();
        tx.set(softClamp(start.get().tx + e.translationX, rangeX(s), width));
        ty.set(softClamp(start.get().ty + e.translationY, rangeY(s), height));
      })
      .onEnd(e => {
        const s = scale.get();
        const fling = (value: SharedValue<number>, velocity: number, range: [number, number]) => {
          'worklet';
          if (range[0] === range[1]) {
            value.set(withSpring(range[0], SETTLE_SPRING));
            return;
          }
          flinging.set(flinging.get() + 1);
          value.set(withDecay(
            { velocity, deceleration: FLING_DECELERATION, clamp: range, rubberBandEffect: true, rubberBandFactor: 0.8 },
            () => {
              const left = flinging.get() - 1;
              flinging.set(left);
              if (left === 0) busy.set(false);
            },
          ));
        };
        fling(tx, e.velocityX, rangeX(s));
        fling(ty, e.velocityY, rangeY(s));
        if (flinging.get() === 0) busy.set(false);
      });

    // Zooms around the focal point and follows it, so two fingers also pan.
    const pinch = Gesture.Pinch()
      .onStart(e => {
        stopAll();
        busy.set(true);
        // The overview's zoom is the director's; pinching it takes the camera over.
        const m = mode.get();
        if (m === 'overview' || m === 'intro') mode.set('free');
        start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), focalX: e.focalX, focalY: e.focalY });
      })
      .onUpdate(e => {
        const s0 = start.get();
        const next = softZoom(s0.scale * e.scale);
        const ratio = next / s0.scale;
        scale.set(next);
        focal.set({ x: e.focalX, y: e.focalY });
        tx.set(softClamp(e.focalX - (s0.focalX - s0.tx) * ratio, rangeX(next), width));
        ty.set(softClamp(e.focalY - (s0.focalY - s0.ty) * ratio, rangeY(next), height));
      })
      .onEnd(() => {
        // Spring back inside the zoom limits around the last focal point, and inside the edges.
        const s = scale.get();
        const target = clampZoom(s);
        zoom.set(target);
        scheduleOnRN(onZoom, target);
        const ratio = target / s;
        const f = focal.get();
        const targetX = clampTo(f.x - (f.x - tx.get()) * ratio, rangeX(target));
        const targetY = clampTo(f.y - (f.y - ty.get()) * ratio, rangeY(target));
        if (target === s && targetX === tx.get() && targetY === ty.get()) {
          busy.set(false);
          return;
        }
        scale.set(withSpring(target, SETTLE_SPRING, settleDone));
        tx.set(withSpring(targetX, SETTLE_SPRING));
        ty.set(withSpring(targetY, SETTLE_SPRING));
      });

    const tap = Gesture.Tap()
      .maxDuration(250)
      .onBegin(() => {
        // Touching a gliding camera stops it, like a scrolling list.
        const wasFlinging = flinging.get() > 0;
        stoppedFling.set(wasFlinging);
        if (wasFlinging) {
          stopAll();
          busy.set(false);
        }
      })
      .onEnd((e, success) => {
        if (!success || stoppedFling.get()) return;
        scheduleOnRN(onTap, (e.x - tx.get()) / scale.get(), (e.y - ty.get()) / scale.get());
      });

    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [width, height, onTap, onZoom, scale, tx, ty, start, focal, bounds, busy, mode, zoom, inset, flinging, stoppedFling]);

  const camera: Camera = useMemo(() => ({ scale, tx, ty }), [scale, tx, ty]);
  const rig: CameraRig = { ...state, camera, busy, bounds, inset, width, height };
  return { camera, rig, transform, gesture };
}
