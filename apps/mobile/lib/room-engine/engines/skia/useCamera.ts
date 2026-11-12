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
/** The zoom buttons' stops, from MIN_ZOOM to MAX_ZOOM. Pinching can land between them. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;
/** How far past MIN_ZOOM / MAX_ZOOM a pinch can stretch before it springs back, as a fraction. */
const ZOOM_STRETCH = 0.15;
/** Resistance when dragging past an edge (iOS uses 0.55): lower is stiffer. */
const RUBBER_BAND = 0.55;
/** Per-millisecond velocity kept by a fling; closer to 1 glides further. */
const FLING_DECELERATION = 0.997;
/** Fingers resting this long (ms) before lifting from a pinch don't fling. */
const MAX_FLING_PAUSE_MS = 80;
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

/** The next zoom stop above (step 1) or below (step -1) `from`, or `from` itself at the end. */
export function stepZoom(from: number, step: 1 | -1): number {
  'worklet';
  // A little slack, so a pinch that ended a hair off a stop doesn't take a tap to reach it.
  const SLACK = 0.02;
  if (step > 0) {
    for (const z of ZOOM_STEPS) if (z > from + SLACK) return z;
    return Math.max(from, MAX_ZOOM);
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) if (ZOOM_STEPS[i] < from - SLACK) return ZOOM_STEPS[i];
  return Math.min(from, MIN_ZOOM);
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
  /**
   * The pinch's reference point, reset whenever a finger lands or lifts. The focal point jumps
   * to the new centre of the fingers then, so measuring from the old one would shift the view.
   * `scale`, `tx` and `ty` are raw (before the rubber band), `shown` is the zoom on screen and `pinch` the event scale then.
   */
  const anchor = useSharedValue({ pointers: 0, pinch: 1, scale: 1, shown: 1, tx: 0, ty: 0, focalX: 0, focalY: 0 });
  /** The pinch's current raw (pre-rubber-band) camera, to re-anchor from without drift. */
  const live = useSharedValue({ scale: 1, tx: 0, ty: 0 });
  const pinching = useSharedValue(false);
  /** The pinch's last focal point and its smoothed velocity (px/s), so letting go flings like a pan. */
  const track = useSharedValue({ x: 0, y: 0, t: 0, vx: 0, vy: 0 });

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
    /** Glides on with `velocity` (px/s) and bounces back at the edges, like a scroll view. */
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
          const left = Math.max(0, flinging.get() - 1);
          flinging.set(left);
          if (left === 0 && !pinching.get()) busy.set(false);
        },
      ));
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
      .onEnd((e, success) => {
        const s = scale.get();
        // A second finger cancels the pan: the pinch takes the camera over from here, so no fling.
        if (!success || pinching.get()) {
          if (!pinching.get()) {
            tx.set(withSpring(clampTo(tx.get(), rangeX(s)), SETTLE_SPRING));
            ty.set(withSpring(clampTo(ty.get(), rangeY(s)), SETTLE_SPRING, settleDone));
          }
          return;
        }
        fling(tx, e.velocityX, rangeX(s));
        fling(ty, e.velocityY, rangeY(s));
        if (flinging.get() === 0) busy.set(false);
      });

    // Zooms around the fingers and follows them, like a photo gallery: the content under the
    // fingers stays under them, so two fingers also pan. Landing or lifting a finger re-anchors
    // instead of jumping, and the fingers left on screen carry on panning from where they are.
    const pinch = Gesture.Pinch()
      .onStart(e => {
        stopAll();
        flinging.set(0);
        busy.set(true);
        pinching.set(true);
        // The overview's zoom is the director's; pinching it takes the camera over.
        const m = mode.get();
        if (m === 'overview' || m === 'intro') mode.set('free');
        const s = scale.get();
        const x = tx.get();
        const y = ty.get();
        const fx = Number.isFinite(e.focalX) ? e.focalX : width / 2;
        const fy = Number.isFinite(e.focalY) ? e.focalY : height / 2;
        const p = Number.isFinite(e.scale) && e.scale > 0 ? e.scale : 1;
        anchor.set({ pointers: e.numberOfPointers, pinch: p, scale: s, shown: s, tx: x, ty: y, focalX: fx, focalY: fy });
        live.set({ scale: s, tx: x, ty: y });
        focal.set({ x: fx, y: fy });
        track.set({ x: fx, y: fy, t: Date.now(), vx: 0, vy: 0 });
      })
      .onUpdate(e => {
        if (!Number.isFinite(e.focalX) || !Number.isFinite(e.focalY) || !Number.isFinite(e.scale) || e.scale <= 0) return;
        let a = anchor.get();
        if (e.numberOfPointers !== a.pointers) {
          // A finger landed or lifted, so the focal point jumped: carry on from here.
          const l = live.get();
          a = { pointers: e.numberOfPointers, pinch: e.scale, scale: l.scale, shown: scale.get(), tx: l.tx, ty: l.ty, focalX: e.focalX, focalY: e.focalY };
          anchor.set(a);
          focal.set({ x: e.focalX, y: e.focalY });
          // Measure speed from the new centre too, or the jump would read as a fast swipe.
          track.set({ ...track.get(), x: e.focalX, y: e.focalY, t: Date.now() });
          return;
        }
        // One finger left only pans; it keeps the zoom.
        const raw = e.numberOfPointers >= 2
          ? Math.min(MAX_ZOOM * 2, Math.max(MIN_ZOOM / 2, (a.scale * e.scale) / a.pinch))
          : a.scale;
        const next = softZoom(raw);
        const ratio = next / a.shown;
        const rawX = e.focalX - (a.focalX - a.tx) * ratio;
        const rawY = e.focalY - (a.focalY - a.ty) * ratio;
        live.set({ scale: raw, tx: rawX, ty: rawY });
        const now = Date.now();
        const k = track.get();
        const dt = now - k.t;
        if (dt > 0) {
          // Smoothed, so one uneven frame doesn't decide the fling.
          const vx = ((e.focalX - k.x) / dt) * 1000;
          const vy = ((e.focalY - k.y) / dt) * 1000;
          track.set({ x: e.focalX, y: e.focalY, t: now, vx: k.vx * 0.3 + vx * 0.7, vy: k.vy * 0.3 + vy * 0.7 });
        }
        scale.set(next);
        focal.set({ x: e.focalX, y: e.focalY });
        tx.set(softClamp(rawX, rangeX(next), width));
        ty.set(softClamp(rawY, rangeY(next), height));
      })
      .onFinalize(() => {
        pinching.set(false);
      })
      .onEnd(() => {
        pinching.set(false);
        const s = scale.get();
        const target = clampZoom(s);
        zoom.set(target);
        scheduleOnRN(onZoom, target);
        if (target === s) {
          // Inside the zoom limits: glide on with the fingers' speed, the same as a swipe.
          // Fingers held still before lifting don't fling.
          const k = track.get();
          const still = Date.now() - k.t > MAX_FLING_PAUSE_MS;
          const vx = still || !Number.isFinite(k.vx) ? 0 : k.vx;
          const vy = still || !Number.isFinite(k.vy) ? 0 : k.vy;
          fling(tx, vx, rangeX(s));
          fling(ty, vy, rangeY(s));
          if (flinging.get() === 0) busy.set(false);
          return;
        }
        // Past a zoom limit: spring back inside it around the last focal point, and inside the edges.
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
  }, [width, height, onTap, onZoom, scale, tx, ty, start, focal, bounds, busy, mode, zoom, inset, flinging, stoppedFling, anchor, live, pinching, track]);

  const camera: Camera = useMemo(() => ({ scale, tx, ty }), [scale, tx, ty]);
  const rig: CameraRig = { ...state, camera, busy, bounds, inset, width, height };
  return { camera, rig, transform, gesture };
}
