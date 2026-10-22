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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  makeMutable,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { ActorAction, ActorActionKind, Facing, RoomItem } from '@chat-app/shared-types';
import type { ActorState } from '../../core/contract';
import { facingFromDelta, facingToView } from '../../core/facing';
import { findSeat } from '../../core/seats';
import type { ActorMotion } from './actorMotion';
import { itemDepth, itemRect } from './geometry';
import { WALK_AUTHORED_MS_PER_CELL, isEmoteClip, type ClipId } from './skeleton/clips';
import type { AvatarArt, TintGroup } from './skeleton/avatarArt';
import { COMPILED_CLIPS, blendPose, samplePose, solveWorld } from './skeleton/sampler';
import { PLACEHOLDER_ART } from './wearables/useAvatarArts';

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
/**
 * A seated actor draws just in front of its seat item, and the item's front layer just
 * in front of the actor. Both stay below anything standing in front of the item.
 */
const SEATED_DEPTH = 0.01;
const FRONT_LAYER_DEPTH = 0.02;
/** Longest an actor walking off a seat keeps the seated depth, until it clears the item. */
const STAND_HOLD_S = 1.5;

/** Everything the UI thread needs about one actor; rebuilt when actors change. */
interface ActorDraw {
  id: string;
  motion: ActorMotion;
  walking: boolean;
  sitting: boolean;
  emoting: boolean;
  /** The emote's clip, or '' when not emoting or the client has no clip for it. */
  emote: ClipId | '';
  /** Seconds into the emote to start at; non-zero when we saw it start late (joined the room mid-emote). */
  emoteStart: number;
  /** Changes with every new action, so the same emote sent twice plays twice. */
  actionKey: number;
  /** Depth of the item the actor sits on, or -1. */
  seatDepth: number;
  facing: Facing;
  msPerCell: number;
  isLocal: boolean;
  /** Key into the arts input; art travels separately so moving actors don't re-copy it. */
  artKey: string;
  /** Programmer-art colours: five, not one per sprite, which keeps hand-offs small. */
  tints: Record<TintGroup, SkColor>;
}

interface ItemDraw {
  image: SkImage;
  /** Drawn over seated actors; same framing as `image`, so it shares `dst`. */
  front: SkImage | null;
  depth: number;
  /** [x, y, w, h] */
  src: number[];
  frontSrc: number[];
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
  /** Seat item depth held while sitting and briefly while standing up, or -1. */
  seatDepth: number;
  standHold: number;
  actionKey: number;
  /** Last emote action reported finished, so each is reported once. */
  reportedKey: number;
}

const actionKeys = new WeakMap<ActorAction, number>();
let nextActionKey = 1;

/** A number per action object; the session keeps an actor's action object until it changes. */
function actionKey(action: ActorAction): number {
  let key = actionKeys.get(action);
  if (key === undefined) {
    key = nextActionKey++;
    actionKeys.set(action, key);
  }
  return key;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const tintCache = new Map<string, Record<TintGroup, SkColor>>();

/** Placeholder outfit colours, stable per user and cached so re-renders don't reallocate them. */
function actorTints(id: string): Record<TintGroup, SkColor> {
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

/** Fit an image inside a rect, centred, keeping its aspect ratio (CSS `contain`). */
function containDst(image: SkImage, rect: { x: number; y: number; width: number; height: number }): number[] {
  const scale = Math.min(rect.width / image.width(), rect.height / image.height());
  const w = image.width() * scale;
  const h = image.height() * scale;
  return [rect.x + (rect.width - w) / 2, rect.y + (rect.height - h) / 2, w, h];
}

/**
 * Painter's-algorithm order. A named worklet on purpose: the React Compiler hoists
 * capture-free inline lambdas out of hooks into plain module functions, which the
 * frame-callback worklet can then no longer call on the UI thread.
 */
function byDepth(p: { depth: number }, q: { depth: number }): number {
  'worklet';
  return p.depth - q.depth;
}

function advance(prev: AnimRuntime | undefined, a: ActorDraw, gx: number, gy: number, dt: number): AnimRuntime {
  'worklet';
  const want: ClipId = a.walking ? 'walk' : a.sitting ? 'sit' : a.emote !== '' ? a.emote : 'idle';
  const startTime = want === a.emote ? a.emoteStart : 0;
  if (!prev) {
    return {
      clip: want, time: startTime, prevClip: '', prevTime: 0, fade: 1,
      facing: a.facing, propFacing: a.facing, lastGx: gx, lastGy: gy,
      seatDepth: a.seatDepth, standHold: 0, actionKey: a.actionKey, reportedKey: 0,
    };
  }
  const st = { ...prev };

  // Keep drawing in front of the seat while getting up, so the actor doesn't pop behind it.
  if (a.sitting) {
    st.seatDepth = a.seatDepth;
    st.standHold = STAND_HOLD_S;
  } else if (st.seatDepth >= 0) {
    st.standHold -= dt;
    if (st.standHold <= 0 || gx + gy + 0.5 >= st.seatDepth) st.seatDepth = -1;
  }

  // Face the direction of travel while moving; otherwise follow the session. Sitting
  // takes the seat's facing even while sliding back onto the cushion.
  const dgx = gx - st.lastGx;
  const dgy = gy - st.lastGy;
  if (a.sitting) st.facing = a.facing;
  else if (Math.abs(dgx) + Math.abs(dgy) > MOVE_EPSILON) st.facing = facingFromDelta(dgx, dgy);
  else if (a.facing !== st.propFacing) st.facing = a.facing;
  st.propFacing = a.facing;
  st.lastGx = gx;
  st.lastGy = gy;

  // A new emote restarts its clip even when it is the one already playing.
  const replay = a.emoting && a.actionKey !== st.actionKey;
  st.actionKey = a.actionKey;
  if (want !== st.clip || replay) {
    st.prevClip = st.clip;
    st.prevTime = st.time;
    st.clip = want;
    st.time = startTime;
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

/** True once per emote action, when its clip has played to the end (at once if it has none). */
function emoteFinished(st: AnimRuntime, a: ActorDraw): boolean {
  'worklet';
  if (!a.emoting || st.reportedKey === a.actionKey) return false;
  if (a.emote !== '' && (st.clip !== a.emote || st.time < COMPILED_CLIPS[a.emote].front.duration)) return false;
  st.reportedKey = a.actionKey;
  return true;
}

function drawAvatar(
  canvas: SkCanvas,
  art: AvatarArt,
  st: AnimRuntime,
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

interface Params {
  actors: Readonly<Record<string, ActorState>>;
  motions: ReadonlyMap<string, ActorMotion>;
  localActorId: string;
  items: RoomItem[];
  /** Reports an emote that finished playing. */
  onActionComplete(actorId: string, action: ActorActionKind): void;
  /** Avatar art by key, and each actor's key (see useAvatarArts). */
  arts: Readonly<Record<string, AvatarArt>>;
  artKeys: Readonly<Record<string, string>>;
  itemImages: Readonly<Record<string, SkImage | null>>;
  selectedPlaced: RoomItem | null;
  origin: GridOrigin;
}

/**
 * The world layer: items and avatars, depth-sorted together and redrawn every frame
 * on the UI thread into one SkPicture. React only rebuilds the inputs when actors or
 * items change; motion, animation and sorting never touch the JS thread.
 *
 * The frame callback is registered once. Its inputs reach it through shared values,
 * because useFrameCallback re-registers (and re-copies everything the worklet
 * captures to the UI runtime) whenever the callback changes. With 30 wandering
 * avatars that happened several times a second.
 */
export function useWorldPicture({
  actors, motions, localActorId, items, arts, artKeys, itemImages, selectedPlaced, origin, onActionComplete,
}: Params): SharedValue<SkPicture> {
  const [picture] = useState(() => makeMutable(createPicture(() => {})));
  const anim = useSharedValue<Record<string, AnimRuntime>>({});

  // The frame worklet captures one stable function; it forwards to the latest callback.
  const completeRef = useRef(onActionComplete);
  useEffect(() => {
    completeRef.current = onActionComplete;
  });
  const [reportEmoteDone] = useState(() => (actorId: string) => completeRef.current(actorId, 'emote'));

  const actorDraws = useMemo<ActorDraw[]>(() => Object.values(actors).flatMap(a => {
    const motion = motions.get(a.id);
    if (!motion) return [];
    const seat = a.action.kind === 'sit' ? findSeat(items, a.action) : null;
    return [{
      id: a.id,
      motion,
      walking: a.action.kind === 'walk',
      sitting: a.action.kind === 'sit',
      emoting: a.action.kind === 'emote',
      emote: a.action.kind === 'emote' && isEmoteClip(a.action.animation) ? a.action.animation : '',
      emoteStart: a.action.kind === 'emote' ? (a.action.elapsedMs ?? 0) / 1000 : 0,
      actionKey: actionKey(a.action),
      seatDepth: seat ? itemDepth(seat.item) + SEATED_DEPTH : -1,
      facing: a.facing,
      msPerCell: a.user?.attributes?.speed ?? DEFAULT_MS_PER_CELL,
      isLocal: a.id === localActorId,
      artKey: artKeys[a.id],
      tints: actorTints(a.id),
    }];
  }), [actors, motions, localActorId, artKeys, items]);

  const itemDraws = useMemo<ItemDraw[]>(() => items.flatMap(ri => {
    const image = itemImages[ri.itemId.assetUrl];
    if (!image) return [];
    const rect = itemRect(ri, origin);
    const front = ri.itemId.frontAssetUrl ? itemImages[ri.itemId.frontAssetUrl] ?? null : null;
    return [{
      image,
      front,
      depth: itemDepth(ri),
      src: [0, 0, image.width(), image.height()],
      frontSrc: front ? [0, 0, front.width(), front.height()] : [],
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

  const actorsInput = useSharedValue<ActorDraw[]>([]);
  const itemsInput = useSharedValue<ItemDraw[]>([]);
  const originInput = useSharedValue(origin);
  const artsInput = useSharedValue(arts);
  useEffect(() => actorsInput.set(actorDraws), [actorsInput, actorDraws]);
  useEffect(() => itemsInput.set(itemDraws), [itemsInput, itemDraws]);
  useEffect(() => originInput.set(origin), [originInput, origin]);
  useEffect(() => artsInput.set(arts), [artsInput, arts]);

  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    const actorDraws = actorsInput.get();
    const itemDraws = itemsInput.get();
    const origin = originInput.get();
    const arts = artsInput.get();
    const prev = anim.get();
    const next: Record<string, AnimRuntime> = {};

    const entries: { depth: number; actor: number; item: number; front: boolean }[] = [];
    const feet: { x: number; y: number }[] = [];
    for (let i = 0; i < actorDraws.length; i++) {
      const a = actorDraws[i];
      const gx = a.motion.gx.get();
      const gy = a.motion.gy.get();
      const st = advance(prev[a.id], a, gx, gy, dt);
      next[a.id] = st;
      if (emoteFinished(st, a)) scheduleOnRN(reportEmoteDone, a.id);
      feet.push(gridToScreen(gx, gy, a.motion.gz.get(), origin));
      const depth = gx + gy + 0.5;
      entries.push({ depth: st.seatDepth >= 0 ? Math.max(depth, st.seatDepth) : depth, actor: i, item: -1, front: false });
    }
    for (let i = 0; i < itemDraws.length; i++) {
      const it = itemDraws[i];
      entries.push({ depth: it.depth, actor: -1, item: i, front: false });
      if (it.front) entries.push({ depth: it.depth + FRONT_LAYER_DEPTH, actor: -1, item: i, front: true });
    }
    entries.sort(byDepth);
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
          const image = e.front && it.front ? it.front : it.image;
          const src = e.front ? it.frontSrc : it.src;
          canvas.drawImageRect(
            image,
            Skia.XYWHRect(src[0], src[1], src[2], src[3]),
            Skia.XYWHRect(it.dst[0], it.dst[1], it.dst[2], it.dst[3]),
            paint,
          );
          if (it.selected && !e.front) {
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
          const art = arts[a.artKey] ?? arts[PLACEHOLDER_ART];
          if (art) drawAvatar(canvas, art, next[a.id], a.tints, x, y);
        }
      }
    }));
  }, [actorsInput, itemsInput, originInput, artsInput, anim, picture, colors, reportEmoteDone]);

  useFrameCallback(onFrame);

  return picture;
}
