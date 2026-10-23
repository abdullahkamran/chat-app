import { createPicture, type SkColor, type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useState } from 'react';
import {
  makeMutable,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';

import type { Facing } from '@chat-app/shared-types';
import { drawAvatar, placeholderTints } from './drawAvatar';
import type { AvatarArt, TintGroup } from './skeleton/avatarArt';

/** Placeholder colours for the preview's programmer art, the same on every open. */
const PREVIEW_TINT_KEY = 'avatar-preview';

interface Layout {
  /** Where the rig root (the feet) goes, in canvas pixels. */
  feetX: number;
  feetY: number;
  /** Canvas pixels per rig content pixel (rooms draw at 1 times the camera zoom). */
  scale: number;
}

interface Params extends Layout {
  /** The art to draw: a composed outfit, or the programmer-art placeholder while it composes. */
  art: AvatarArt;
  facing: Facing;
  /**
   * Play the idle clip every frame. When false, one idle pose is drawn and redrawn only
   * when its inputs change: for lists of avatar cards, where a frame loop each would add up.
   */
  animated: boolean;
}

/** One idle pose `time` seconds in, scaled and placed on the canvas. Runs on either thread. */
function recordAvatar(
  art: AvatarArt,
  facing: Facing,
  time: number,
  tints: Record<TintGroup, SkColor>,
  layout: Layout,
): SkPicture {
  'worklet';
  const st = { clip: 'idle' as const, time, prevClip: '' as const, prevTime: 0, fade: 1, facing };
  return createPicture(canvas => {
    canvas.save();
    canvas.translate(layout.feetX, layout.feetY);
    canvas.scale(layout.scale, layout.scale);
    drawAvatar(canvas, art, st, tints, 0, 0);
    canvas.restore();
  });
}

/**
 * One avatar idling, recorded into an SkPicture: the room's drawAvatar on its own, for
 * previews outside rooms. Animated previews redraw every frame on the UI thread and, like
 * useWorldPicture, take their inputs through shared values so the frame callback is
 * registered once. Still previews draw on the JS thread when an input changes.
 */
export function useAvatarPreviewPicture({ art, facing, feetX, feetY, scale, animated }: Params): SharedValue<SkPicture> {
  const [picture] = useState(() => makeMutable(createPicture(() => {})));
  const [tints] = useState(() => placeholderTints(PREVIEW_TINT_KEY));
  const time = useSharedValue(0);

  const artInput = useSharedValue(art);
  const facingInput = useSharedValue(facing);
  const layoutInput = useSharedValue({ feetX, feetY, scale });
  useEffect(() => artInput.set(art), [artInput, art]);
  useEffect(() => facingInput.set(facing), [facingInput, facing]);
  useEffect(() => layoutInput.set({ feetX, feetY, scale }), [layoutInput, feetX, feetY, scale]);

  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    const t = time.get() + (frame.timeSincePreviousFrame ?? 0) / 1000;
    time.set(t);
    picture.set(recordAvatar(artInput.get(), facingInput.get(), t, tints, layoutInput.get()));
  }, [time, artInput, facingInput, layoutInput, picture, tints]);

  useFrameCallback(onFrame, animated);

  useEffect(() => {
    if (animated) return;
    picture.set(recordAvatar(art, facing, 0, tints, { feetX, feetY, scale }));
  }, [animated, art, facing, feetX, feetY, scale, picture, tints]);

  return picture;
}
