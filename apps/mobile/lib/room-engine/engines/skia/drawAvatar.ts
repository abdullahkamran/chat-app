import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkColor,
} from '@shopify/react-native-skia';

import { theme } from '@/constants/theme';
import type { Facing } from '@chat-app/shared-types';
import { facingToView } from '../../core/facing';
import type { ClipId } from './skeleton/clips';
import type { AvatarArt, TintGroup } from './skeleton/avatarArt';
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

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const tintCache = new Map<string, Record<TintGroup, SkColor>>();

/**
 * Programmer-art placeholder colours, stable per key (a user id in rooms) and cached so
 * re-renders don't reallocate them.
 */
export function placeholderTints(id: string): Record<TintGroup, SkColor> {
  let tints = tintCache.get(id);
  if (!tints) {
    const n = theme.avatarPalette.length;
    const h = hashId(id);
    tints = {
      skin: Skia.Color(theme.colors.avatarPlaceholderSkin),
      tops: Skia.Color(theme.avatarPalette[h % n]),
      bottoms: Skia.Color(theme.avatarPalette[(h + 3) % n]),
      footwear: Skia.Color(theme.colors.avatarPlaceholderHair),
      hair: Skia.Color(theme.colors.avatarPlaceholderHair),
    };
    tintCache.set(id, tints);
  }
  return tints;
}

/**
 * Draws one avatar with its feet at (feetX, feetY): sample the clip (crossfading from the
 * previous one), solve the bones, then one drawAtlas. A UI-thread worklet; rooms and the
 * avatar editor's preview both draw through it.
 */
export function drawAvatar(
  canvas: SkCanvas,
  art: AvatarArt,
  st: AvatarPlayhead,
  tints: Record<TintGroup, SkColor>,
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
  const list = art.views[view];
  const xforms = [];
  const colors: SkColor[] = [];
  for (let i = 0; i < list.bone.length; i++) {
    if (art.tinted) colors.push(tints[list.tint[i]]);
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
    art.tinted ? colors : undefined,
    ATLAS_SAMPLING,
  );
}
