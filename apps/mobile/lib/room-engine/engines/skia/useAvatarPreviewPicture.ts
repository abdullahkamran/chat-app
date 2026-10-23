import { createPicture, type SkPicture } from '@shopify/react-native-skia';
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
import type { AvatarArt } from './skeleton/avatarArt';

/** Placeholder colours for the preview's programmer art, the same on every open. */
const PREVIEW_TINT_KEY = 'avatar-preview';

interface Params {
  /** The art to draw: a composed outfit, or the programmer-art placeholder while it composes. */
  art: AvatarArt;
  facing: Facing;
  /** Where the rig root (the feet) goes, in canvas pixels. */
  feetX: number;
  feetY: number;
  /** Canvas pixels per rig content pixel (rooms draw at 1 times the camera zoom). */
  scale: number;
}

/**
 * One avatar playing the idle clip, redrawn every frame on the UI thread into an
 * SkPicture: the room's drawAvatar on its own, for previews outside rooms. Like
 * useWorldPicture, inputs reach the frame worklet through shared values so it is
 * registered once.
 */
export function useAvatarPreviewPicture({ art, facing, feetX, feetY, scale }: Params): SharedValue<SkPicture> {
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
    const art = artInput.get();
    const layout = layoutInput.get();
    const st = { clip: 'idle' as const, time: t, prevClip: '' as const, prevTime: 0, fade: 1, facing: facingInput.get() };
    picture.set(createPicture(canvas => {
      canvas.save();
      canvas.translate(layout.feetX, layout.feetY);
      canvas.scale(layout.scale, layout.scale);
      drawAvatar(canvas, art, st, tints, 0, 0);
      canvas.restore();
    }));
  }, [time, artInput, facingInput, layoutInput, picture, tints]);

  useFrameCallback(onFrame);

  return picture;
}
