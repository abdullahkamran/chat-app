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
import { ghostColorAt, useGhostColors, type GhostColors } from './avatarGhost';
import { drawAvatar, type AvatarPlayhead } from './drawAvatar';
import type { AvatarArt } from './skeleton/avatarArt';
import { CLIPS, type ClipId } from './skeleton/clips';

/** A one-shot clip replays after this long idling, in seconds. */
const REST_S = 0.9;
/** Crossfade between the idle and the clip, each way. */
const FADE_S = 0.2;
/** Still previews of a one-shot clip show it this far through: mid move, so it reads. */
const STILL_AT = 0.4;

interface ClipInput {
  clip: ClipId;
  duration: number;
  loop: boolean;
}

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
  /** The clip to show; one-shot clips replay with a short idle between. Defaults to idle. */
  clip?: ClipId;
  /**
   * Play the clip every frame. When false, one idle pose is drawn and redrawn only
   * when its inputs change (a one-shot clip mid move): for lists of avatar cards, where a
   * frame loop each would add up.
   * The loading ghost always animates, so it pulses until the outfit is ready.
   */
  animated: boolean;
}

/**
 * Where the preview is `time` seconds in. A looping clip just plays; a one-shot plays, rests
 * REST_S on idle, and goes again, fading in and out of the idle.
 */
function playheadAt(input: ClipInput, time: number, facing: Facing): AvatarPlayhead {
  'worklet';
  const { clip, duration, loop } = input;
  if (loop) return { clip, time, prevClip: '', prevTime: 0, fade: 1, facing };
  const c = time % (duration + REST_S);
  if (c < duration) {
    const fade = Math.min(1, c / FADE_S);
    return { clip, time: c, prevClip: fade < 1 ? 'idle' : '', prevTime: time, fade, facing };
  }
  const r = c - duration;
  const fade = Math.min(1, r / FADE_S);
  return { clip: 'idle', time: r, prevClip: fade < 1 ? clip : '', prevTime: duration, fade, facing };
}

/** One pose `time` seconds in, scaled and placed on the canvas. Runs on either thread. */
function recordAvatar(
  art: AvatarArt,
  input: ClipInput,
  facing: Facing,
  time: number,
  ghost: GhostColors,
  layout: Layout,
): SkPicture {
  'worklet';
  const st = playheadAt(input, time, facing);
  return createPicture(canvas => {
    canvas.save();
    canvas.translate(layout.feetX, layout.feetY);
    canvas.scale(layout.scale, layout.scale);
    drawAvatar(canvas, art, st, ghostColorAt(ghost, time * 1000), 0, 0);
    canvas.restore();
  });
}

/**
 * One avatar idling (or playing `clip`), recorded into an SkPicture: the room's drawAvatar on its own, for
 * previews outside rooms. Animated previews redraw every frame on the UI thread and, like
 * useWorldPicture, take their inputs through shared values so the frame callback is
 * registered once. Still previews draw on the JS thread when an input changes.
 */
export function useAvatarPreviewPicture({ art, facing, clip = 'idle', feetX, feetY, scale, animated }: Params): SharedValue<SkPicture> {
  const [picture] = useState(() => makeMutable(createPicture(() => {})));
  const ghost = useGhostColors();
  const time = useSharedValue(0);

  const artInput = useSharedValue(art);
  const facingInput = useSharedValue(facing);
  const { duration, loop } = CLIPS[clip].front;
  const clipInput = useSharedValue<ClipInput>({ clip, duration, loop });
  const layoutInput = useSharedValue({ feetX, feetY, scale });
  useEffect(() => artInput.set(art), [artInput, art]);
  useEffect(() => facingInput.set(facing), [facingInput, facing]);
  useEffect(() => {
    clipInput.set({ clip, duration, loop });
    time.set(0);
  }, [clipInput, time, clip, duration, loop]);
  useEffect(() => layoutInput.set({ feetX, feetY, scale }), [layoutInput, feetX, feetY, scale]);

  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    const t = time.get() + (frame.timeSincePreviousFrame ?? 0) / 1000;
    time.set(t);
    picture.set(recordAvatar(artInput.get(), clipInput.get(), facingInput.get(), t, ghost, layoutInput.get()));
  }, [time, artInput, clipInput, facingInput, layoutInput, picture, ghost]);

  const playing = animated || art.ghost;
  // useFrameCallback only reads its autostart flag once, so a preview that mounts still and
  // later scrolls into view would never start: switch it explicitly. It unregisters on unmount.
  const frameCallback = useFrameCallback(onFrame, false);
  useEffect(() => {
    frameCallback.setActive(playing);
    return () => frameCallback.setActive(false);
  }, [frameCallback, playing, onFrame]);

  useEffect(() => {
    if (playing) return;
    const stillAt = loop ? 0 : duration * STILL_AT;
    picture.set(recordAvatar(art, { clip, duration, loop }, facing, stillAt, ghost, { feetX, feetY, scale }));
  }, [playing, art, clip, duration, loop, facing, feetX, feetY, scale, picture, ghost]);

  return picture;
}
