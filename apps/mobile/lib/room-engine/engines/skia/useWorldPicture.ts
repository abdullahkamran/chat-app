import {
  BlendMode,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  createPicture,
  type SkCanvas,
  type SkColor,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { makeMutable, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { Facing, RigView, RoomItem } from '@chat-app/shared-types';
import type { ActorState } from '../../core/contract';
import { facingFromDelta, facingToView } from '../../core/facing';
import type { ActorMotion } from './actorMotion';
import { itemDepth, itemRect } from './geometry';
import { WALK_AUTHORED_MS_PER_CELL, type ClipId } from './skeleton/clips';
import { ART_SCALE, getAvatarArt, type AvatarArt, type TintGroup } from './skeleton/programmerArt';
import { COMPILED_CLIPS, blendPose, samplePose, solveWorld } from './skeleton/sampler';

const CROSSFADE_S = 0.15;
const DEFAULT_MS_PER_CELL = 500;
/** Grid cells moved per frame below which an actor counts as standing still. */
const MOVE_EPSILON = 1e-5;
const SHADOW_W = 30;
const SHADOW_H = 10;
const SHADOW_ALPHA = 0.35;
const SELECTED_SCALE = 1.08;
const SELECTED_ALPHA = 0.7;
const SELECTED_TINT_ALPHA = 0.25;
const ATLAS_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

/** Everything the UI thread needs about one actor; rebuilt when actors change. */
interface ActorDraw {
  id: string;
  motion: ActorMotion;
  walking: boolean;
  facing: Facing;
  msPerCell: number;
  isLocal: boolean;
  colors: Record<RigView, SkColor[]>;
}

interface ItemDraw {
  image: SkImage;
  depth: number;
  /** [x, y, w, h] */
  src: number[];
  dst: number[];
  rect: number[];
  selected: boolean;
}

/** Per-actor animation playhead, carried across frames on the UI thread. */
interface AnimRuntime {
  clip: ClipId;
  time: number;
  /** Clip being faded out, or '' when not crossfading. */
  prevClip: ClipId | '';
  prevTime: number;
  fade: number;
  facing: Facing;
  /** The session's facing last frame, to notice when it changes (e.g. sitting). */
  propFacing: Facing;
  lastGx: number;
  lastGy: number;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Placeholder outfit colours, stable per user. */
function actorColors(id: string, art: AvatarArt): Record<RigView, SkColor[]> {
  const n = theme.avatarPalette.length;
  const h = hashId(id);
  const tints: Record<TintGroup, SkColor> = {
    skin: Skia.Color(theme.colors.avatarPlaceholderSkin),
    tops: Skia.Color(theme.avatarPalette[h % n]),
    bottoms: Skia.Color(theme.avatarPalette[(h + 3) % n]),
    footwear: Skia.Color(theme.colors.avatarPlaceholderHair),
    hair: Skia.Color(theme.colors.avatarPlaceholderHair),
  };
  return {
    front: art.views.front.tint.map(g => tints[g]),
    back: art.views.back.tint.map(g => tints[g]),
  };
}

/** Fit an image inside a rect, centred, keeping its aspect ratio (CSS `contain`). */
function containDst(image: SkImage, rect: { x: number; y: number; width: number; height: number }): number[] {
  const scale = Math.min(rect.width / image.width(), rect.height / image.height());
  const w = image.width() * scale;
  const h = image.height() * scale;
  return [rect.x + (rect.width - w) / 2, rect.y + (rect.height - h) / 2, w, h];
}

function advance(prev: AnimRuntime | undefined, a: ActorDraw, gx: number, gy: number, dt: number): AnimRuntime {
  'worklet';
  const want: ClipId = a.walking ? 'walk' : 'idle';
  if (!prev) {
    return {
      clip: want, time: 0, prevClip: '', prevTime: 0, fade: 1,
      facing: a.facing, propFacing: a.facing, lastGx: gx, lastGy: gy,
    };
  }
  const st = { ...prev };

  // Face the direction of travel while moving; otherwise follow the session.
  const dgx = gx - st.lastGx;
  const dgy = gy - st.lastGy;
  if (Math.abs(dgx) + Math.abs(dgy) > MOVE_EPSILON) st.facing = facingFromDelta(dgx, dgy);
  else if (a.facing !== st.propFacing) st.facing = a.facing;
  st.propFacing = a.facing;
  st.lastGx = gx;
  st.lastGy = gy;

  if (want !== st.clip) {
    st.prevClip = st.clip;
    st.prevTime = st.time;
    st.clip = want;
    st.time = 0;
    st.fade = 0;
  }

  // Walk playback follows the actor's pace so feet don't slide.
  const rate = st.clip === 'walk' ? WALK_AUTHORED_MS_PER_CELL / a.msPerCell : 1;
  st.time += dt * rate;
  if (st.prevClip !== '') {
    st.prevTime += dt;
    st.fade = Math.min(1, st.fade + dt / CROSSFADE_S);
    if (st.fade >= 1) st.prevClip = '';
  }
  return st;
}

function drawAvatar(
  canvas: SkCanvas,
  art: AvatarArt,
  st: AnimRuntime,
  colors: Record<RigView, SkColor[]>,
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
  for (let i = 0; i < list.bone.length; i++) {
    const b = list.bone[i];
    const x = mirror ? -bones.x[b] : bones.x[b];
    const angle = mirror ? -bones.angle[b] : bones.angle[b];
    const px = mirror ? list.pivotXMirror[i] : list.pivotX[i];
    xforms.push(Skia.RSXformFromRadians(1 / ART_SCALE, angle, feetX + x, feetY + bones.y[b], px, list.pivotY[i]));
  }
  canvas.drawAtlas(
    art.image,
    mirror ? list.srcMirror : list.src,
    xforms,
    Skia.Paint(),
    BlendMode.Modulate,
    colors[view],
    ATLAS_SAMPLING,
  );
}

interface Params {
  actors: Readonly<Record<string, ActorState>>;
  motions: ReadonlyMap<string, ActorMotion>;
  localActorId: string;
  items: RoomItem[];
  itemImages: Readonly<Record<string, SkImage | null>>;
  selectedPlaced: RoomItem | null;
  origin: GridOrigin;
}

/**
 * The world layer: items and avatars, depth-sorted together and redrawn every frame
 * on the UI thread into one SkPicture. React only rebuilds the inputs when actors or
 * items change; motion, animation and sorting never touch the JS thread.
 */
export function useWorldPicture({
  actors, motions, localActorId, items, itemImages, selectedPlaced, origin,
}: Params): SharedValue<SkPicture> {
  const [picture] = useState(() => makeMutable(createPicture(() => {})));
  const anim = useSharedValue<Record<string, AnimRuntime>>({});
  const art = getAvatarArt();

  const actorDraws = useMemo<ActorDraw[]>(() => Object.values(actors).flatMap(a => {
    const motion = motions.get(a.id);
    if (!motion) return [];
    return [{
      id: a.id,
      motion,
      walking: a.action.kind === 'walk',
      facing: a.facing,
      msPerCell: a.user?.attributes?.speed ?? DEFAULT_MS_PER_CELL,
      isLocal: a.id === localActorId,
      colors: actorColors(a.id, art),
    }];
  }), [actors, motions, localActorId, art]);

  const itemDraws = useMemo<ItemDraw[]>(() => items.flatMap(ri => {
    const image = itemImages[ri.itemId.assetUrl];
    if (!image) return [];
    const rect = itemRect(ri, origin);
    return [{
      image,
      depth: itemDepth(ri),
      src: [0, 0, image.width(), image.height()],
      dst: containDst(image, rect),
      rect: [rect.x, rect.y, rect.width, rect.height],
      selected: ri === selectedPlaced,
    }];
  }), [items, itemImages, selectedPlaced, origin]);

  const colors = useMemo(() => ({
    shadow: Skia.Color(theme.colors.background),
    local: Skia.Color(theme.colors.primary),
    tint: Skia.Color(theme.colors.primary),
  }), []);

  useFrameCallback(frame => {
    'worklet';
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    const prev = anim.get();
    const next: Record<string, AnimRuntime> = {};

    const entries: { depth: number; actor: number; item: number }[] = [];
    const feet: { x: number; y: number }[] = [];
    for (let i = 0; i < actorDraws.length; i++) {
      const a = actorDraws[i];
      const gx = a.motion.gx.get();
      const gy = a.motion.gy.get();
      next[a.id] = advance(prev[a.id], a, gx, gy, dt);
      feet.push(gridToScreen(gx, gy, 0, origin));
      entries.push({ depth: gx + gy + 0.5, actor: i, item: -1 });
    }
    for (let i = 0; i < itemDraws.length; i++) {
      entries.push({ depth: itemDraws[i].depth, actor: -1, item: i });
    }
    entries.sort((p, q) => p.depth - q.depth);
    anim.set(next);

    picture.set(createPicture(canvas => {
      const shadow = Skia.Paint();
      shadow.setColor(colors.shadow);
      shadow.setAlphaf(SHADOW_ALPHA);
      const ring = Skia.Paint();
      ring.setAntiAlias(true);
      ring.setColor(colors.local);
      ring.setStyle(PaintStyle.Stroke);
      ring.setStrokeWidth(2);

      for (const e of entries) {
        if (e.item >= 0) {
          const it = itemDraws[e.item];
          const [x, y, w, h] = it.rect;
          canvas.save();
          const paint = Skia.Paint();
          if (it.selected) {
            canvas.translate(x + w / 2, y + h / 2);
            canvas.scale(SELECTED_SCALE, SELECTED_SCALE);
            canvas.translate(-(x + w / 2), -(y + h / 2));
            paint.setAlphaf(SELECTED_ALPHA);
          }
          canvas.drawImageRect(
            it.image,
            Skia.XYWHRect(it.src[0], it.src[1], it.src[2], it.src[3]),
            Skia.XYWHRect(it.dst[0], it.dst[1], it.dst[2], it.dst[3]),
            paint,
          );
          if (it.selected) {
            const tint = Skia.Paint();
            tint.setColor(colors.tint);
            tint.setAlphaf(SELECTED_TINT_ALPHA * SELECTED_ALPHA);
            canvas.drawRect(Skia.XYWHRect(x, y, w, h), tint);
          }
          canvas.restore();
        } else {
          const a = actorDraws[e.actor];
          const { x, y } = feet[e.actor];
          const oval = Skia.XYWHRect(x - SHADOW_W / 2, y - SHADOW_H / 2, SHADOW_W, SHADOW_H);
          canvas.drawOval(oval, shadow);
          if (a.isLocal) canvas.drawOval(oval, ring);
          drawAvatar(canvas, art, next[a.id], a.colors, x, y);
        }
      }
    }));
  });

  return picture;
}
