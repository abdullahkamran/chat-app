import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkColor,
} from '@shopify/react-native-skia';

import type { Facing } from '@chat-app/shared-types';
import { facingToView } from '../../core/facing';
import type { ClipId } from './skeleton/clips';
import type { AvatarArt } from './skeleton/avatarArt';
import { orderVariantOf } from './skeleton/limbOrder';
import { COMPILED_CLIPS, blendPose, samplePose, solveWorld } from './skeleton/sampler';

const ATLAS_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

/** Where an avatar's animation is this frame: the clip playing, and the one fading out. */
export interface AvatarPlayhead {
  clip: ClipId;
  time: number;
  /** Clip being faded out, or '' when not crossfading. */
  prevClip: ClipId | '';
  prevTime: number;
  /** 0..1 weight of `clip` over `prevClip`. */
  fade: number;
  facing: Facing;
}

/**
 * Draws one avatar with its feet at (feetX, feetY): sample the clip (crossfading from the
 * previous one), solve the bones, pick the limb order the pose calls for, then one drawAtlas. A UI-thread worklet; rooms and the
 * avatar editor's preview both draw through it. `ghost` is this frame's colour for the
 * loading ghost (see avatarGhost.ts); dressed avatars ignore it.
 */
export function drawAvatar(
  canvas: SkCanvas,
  art: AvatarArt,
  st: AvatarPlayhead,
  ghost: SkColor,
  feetX: number,
  feetY: number,
) {
  'worklet';
  const { view, mirror } = facingToView(st.facing);
  let pose = samplePose(COMPILED_CLIPS[st.clip][view], st.time);
  if (st.prevClip !== '') {
    pose = blendPose(samplePose(COMPILED_CLIPS[st.prevClip][view], st.prevTime), pose, st.fade);
  }
  const bones = solveWorld(pose, view);

  // RSXform can't reflect, so the west pair uses pre-flipped sprites with x and angle negated.
  // The pose decides which limbs are in front (an arm reaching forward, the leading leg).
  const list = art.views[view][orderVariantOf(bones, view)];
  const xforms = [];
  const colors: SkColor[] = [];
  for (let i = 0; i < list.bone.length; i++) {
    if (art.ghost) colors.push(ghost);
    const b = list.bone[i];
    const x = mirror ? -bones.x[b] : bones.x[b];
    const angle = mirror ? -bones.angle[b] : bones.angle[b];
    const px = mirror ? list.pivotXMirror[i] : list.pivotX[i];
    const py = mirror ? list.pivotYMirror[i] : list.pivotY[i];
    xforms.push(Skia.RSXformFromRadians(1 / art.scale, angle, feetX + x, feetY + bones.y[b], px, py));
  }
  canvas.drawAtlas(
    art.image,
    mirror ? list.srcMirror : list.src,
    xforms,
    Skia.Paint(),
    BlendMode.Modulate,
    art.ghost ? colors : undefined,
    ATLAS_SAMPLING,
  );
}
