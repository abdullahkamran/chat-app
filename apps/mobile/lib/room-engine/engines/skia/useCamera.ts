import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;

export interface Camera {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

/**
 * Keep the content inside the viewport (like ReactNativeZoomableView's bindToBorders):
 * centred when smaller than the viewport, edge-clamped when larger.
 */
function clampOffset(offset: number, scale: number, size: number): number {
  'worklet';
  const scaled = size * scale;
  if (scaled <= size) return (size - scaled) / 2;
  return Math.min(0, Math.max(size - scaled, offset));
}

function clampZoom(scale: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * Pan and pinch camera driven entirely by shared values, plus a tap gesture that
 * reports taps in content (pre-camera) coordinates.
 *
 * screen = content * scale + (tx, ty)
 */
export function useCamera(
  width: number,
  height: number,
  onTap: (contentX: number, contentY: number) => void,
) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Gesture start state. A shared value, not a closure object: each worklet gets its own copy of captured objects.
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0, focalX: 0, focalY: 0 });

  const transform = useDerivedValue(() => [
    { translateX: tx.get() },
    { translateY: ty.get() },
    { scale: scale.get() },
  ]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        start.set({ ...start.get(), tx: tx.get(), ty: ty.get() });
      })
      .onUpdate(e => {
        tx.set(clampOffset(start.get().tx + e.translationX, scale.get(), width));
        ty.set(clampOffset(start.get().ty + e.translationY, scale.get(), height));
      });

    // Zooms around the focal point and follows it, so two fingers also pan.
    const pinch = Gesture.Pinch()
      .onStart(e => {
        start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), focalX: e.focalX, focalY: e.focalY });
      })
      .onUpdate(e => {
        const s0 = start.get();
        const next = clampZoom(s0.scale * e.scale);
        const ratio = next / s0.scale;
        scale.set(next);
        tx.set(clampOffset(e.focalX - (s0.focalX - s0.tx) * ratio, next, width));
        ty.set(clampOffset(e.focalY - (s0.focalY - s0.ty) * ratio, next, height));
      });

    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, success) => {
        if (!success) return;
        scheduleOnRN(onTap, (e.x - tx.get()) / scale.get(), (e.y - ty.get()) / scale.get());
      });

    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [width, height, onTap, scale, tx, ty, start]);

  const camera: Camera = { scale, tx, ty };
  return { camera, transform, gesture };
}
