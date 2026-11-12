import { useCallback } from 'react';
import { useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TILE_W, gridToScreen, type GridOrigin } from '@/constants/grid';
import type { CameraLink, CameraMode } from '../../core/contract';
import type { ActorMotion } from './actorMotion';
import { AVATAR_HEIGHT } from './skeleton/humanoidV1';
import { MIN_ZOOM, clampTo, offsetRange, stepZoom, visibleHeight, type CameraRig } from './useCamera';

/**
 * The box, as fractions of the visible room, that the followed actor may move inside
 * without the camera moving. A dead zone keeps the room still for small steps, which
 * feels calmer than a camera glued to the actor. Centred a little low so chat bubbles fit.
 */
const DEAD_ZONE = { left: 0.36, right: 0.64, top: 0.38, bottom: 0.62 };
/** How quickly the camera catches up, per second. Higher is snappier. */
const FOLLOW_RATE = 4.5;
/** How quickly the overview reframes as people move, per second. */
const OVERVIEW_RATE = 3;
/** How quickly the zoom eases to its target, per second. */
const ZOOM_RATE = 4;
/** How far ahead of a walking actor the camera aims, in seconds of travel. */
const LOOKAHEAD_S = 0.35;
/** How quickly the measured walking velocity responds to changes, per second. */
const VELOCITY_RATE = 8;
/** A jump further than this in one frame (spawn, door, server correction) snaps the camera. */
const SNAP_DISTANCE = TILE_W * 3;
/** Entering a room shows everyone for this long before gliding to the local actor. */
const INTRO_HOLD_MS = 700;
/** Focusing on someone (a name in the transcript, an off-screen pointer) shows them this long. */
const FOCUS_HOLD_MS = 3500;
/** The overview frames people with this much room around them (px, on screen). */
const OVERVIEW_PAD = { side: 40, top: 70, bottom: 30 };
/** The overview never zooms in further than this, even with one person in the room. */
const OVERVIEW_MAX_ZOOM = 1;
/** A recentre ends once the target is this close (px) to where it is going. */
const SETTLED_PX = 1.5;
/** Movement smaller than this (px) isn't written, so an idle room doesn't redraw. */
const EPSILON = 0.05;

export interface DirectedActor {
  id: string;
  motion: ActorMotion;
}

interface Options {
  rig: CameraRig;
  actors: readonly DirectedActor[];
  localActorId: string;
  origin: GridOrigin;
  link: CameraLink;
  /** Snap instead of glide (the OS Reduce Motion setting). */
  reduceMotion: boolean;
  /** A zoom button picked a new zoom, to remember it. */
  onZoom: (zoom: number) => void;
}

interface Track {
  init: boolean;
  /** Local actor's focus point and smoothed velocity, in content px. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Last command handled. */
  seq: number;
  /** When the intro hold or a focus ends (frame clock), and whom focus shows. */
  until: number;
  focusId: string;
  /** Where focus goes back to. */
  after: CameraMode;
  /** A zoom button was pressed in `free`: the zoom eases to the new step around the middle of the view. */
  zooming: boolean;
  /** Last reported to the shell. */
  reportedMode: CameraMode | '';
  reportedOffscreen: boolean;
  reportedZoomIn: boolean;
  reportedZoomOut: boolean;
}

/**
 * Moves the camera on its own, every frame on the UI thread, according to its mode:
 * follow keeps the local actor (plus a look-ahead in the direction it walks) inside the
 * dead zone; overview frames everyone; focus centres one actor for a while, then goes
 * back; intro shows everyone, then glides to the local actor. Waits while a gesture or
 * fling owns the camera, and in `free` only finishes a zoom button's step. Handles the shell's commands and
 * reports the mode and whether the local actor is in view.
 */
export function useCameraDirector({ rig, actors, localActorId, origin, link, reduceMotion, onZoom }: Options) {
  const { camera, mode, zoom, recentre, busy, bounds, inset, width, height } = rig;
  const { scale, tx, ty } = camera;
  const { command, onChange } = link;
  const track = useSharedValue<Track>({
    init: false, x: 0, y: 0, vx: 0, vy: 0, seq: 0, until: 0, focusId: '', after: 'follow',
    zooming: false, reportedMode: '', reportedOffscreen: false, reportedZoomIn: true, reportedZoomOut: true,
  });

  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    const local = actors.find(a => a.id === localActorId);
    if (!local) return;
    const now = frame.timestamp;
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const t = { ...track.get() };

    const focusPoint = (m: ActorMotion) => {
      'worklet';
      const feet = gridToScreen(m.gx.get(), m.gy.get(), m.gz.get(), origin);
      return { x: feet.x, y: feet.y - AVATAR_HEIGHT / 2, feetY: feet.y };
    };

    // Track the local actor's velocity, for the look-ahead.
    const me = focusPoint(local.motion);
    const jumped = !t.init || Math.hypot(me.x - t.x, me.y - t.y) > SNAP_DISTANCE;
    if (!jumped && dt > 0) {
      const k = 1 - Math.exp(-VELOCITY_RATE * dt);
      t.vx += ((me.x - t.x) / dt - t.vx) * k;
      t.vy += ((me.y - t.y) / dt - t.vy) * k;
    } else {
      t.vx = 0;
      t.vy = 0;
    }
    const first = !t.init;
    t.init = true;
    t.x = me.x;
    t.y = me.y;

    // The shell's commands.
    const c = command.get();
    if (c.seq !== t.seq) {
      t.seq = c.seq;
      const cmd = c.cmd;
      const m = mode.get();
      if (cmd?.kind === 'toggleOverview') {
        if (m === 'overview' || m === 'intro') {
          mode.set('follow');
          recentre.set(true);
        } else {
          mode.set('overview');
        }
      } else if (cmd?.kind === 'followMe') {
        mode.set('follow');
        recentre.set(true);
      } else if (cmd?.kind === 'focus' && actors.some(a => a.id === cmd.actorId)) {
        t.after = m === 'overview' ? 'overview' : 'follow';
        t.focusId = cmd.actorId;
        t.until = now + FOCUS_HOLD_MS;
        mode.set('focus');
      } else if (cmd?.kind === 'zoom') {
        // Like a pinch: the overview's zoom is the director's, so stepping from it takes the
        // camera over, starting from what is on screen.
        const framingNow = m === 'overview' || m === 'intro';
        const next = stepZoom(framingNow ? scale.get() : zoom.get(), cmd.step);
        if (framingNow) mode.set('free');
        zoom.set(next);
        t.zooming = true;
        scheduleOnRN(onZoom, next);
      }
    }

    // Timed modes.
    let m = mode.get();
    if (m === 'intro') {
      if (t.until === 0) t.until = now + INTRO_HOLD_MS;
      else if (now > t.until) {
        t.until = 0;
        mode.set('follow');
        recentre.set(true);
      }
    }
    const focused = m === 'focus' ? actors.find(a => a.id === t.focusId) : undefined;
    if (m === 'focus' && (!focused || now > t.until)) {
      mode.set(t.after);
      if (t.after === 'follow') recentre.set(true);
    }
    m = mode.get();

    const s = scale.get();
    const visH = visibleHeight(height, inset.get());

    // Tell the shell what changed, for its buttons.
    const sx = me.x * s + tx.get();
    const headY = (me.feetY - AVATAR_HEIGHT) * s + ty.get();
    const feetY = me.feetY * s + ty.get();
    const offscreen = sx < 0 || sx > width || feetY < 0 || headY > visH;
    // The zoom buttons step from what is on screen while framing, else from the chosen zoom.
    const zoomFrom = m === 'overview' || m === 'intro' ? s : zoom.get();
    const canZoomIn = stepZoom(zoomFrom, 1) !== zoomFrom;
    const canZoomOut = stepZoom(zoomFrom, -1) !== zoomFrom;
    if (m !== t.reportedMode || offscreen !== t.reportedOffscreen
      || canZoomIn !== t.reportedZoomIn || canZoomOut !== t.reportedZoomOut) {
      t.reportedMode = m;
      t.reportedOffscreen = offscreen;
      t.reportedZoomIn = canZoomIn;
      t.reportedZoomOut = canZoomOut;
      scheduleOnRN(onChange, { mode: m, localOffscreen: offscreen, canZoomIn, canZoomOut });
    }
    // A gesture takes over from a zoom step, as does anything that moves the camera itself.
    if (busy.get() || m !== 'free') t.zooming = false;
    track.set(t);

    const b = bounds.get();
    if (m === 'free' && t.zooming) {
      // A zoom button in `free`: zoom around the middle of the view, kept inside the room.
      const target = zoom.get();
      const ns = s + (target - s) * (reduceMotion ? 1 : 1 - Math.exp(-ZOOM_RATE * dt));
      const done = Math.abs(target - ns) < 0.002;
      const next = done ? target : ns;
      const cx = width / 2;
      const cy = visH / 2;
      scale.set(next);
      tx.set(clampTo(cx - (cx - tx.get()) * (next / s), offsetRange(b.minX, b.maxX, next, width)));
      ty.set(clampTo(cy - (cy - ty.get()) * (next / s), offsetRange(b.minY, b.maxY, next, visH)));
      if (done) track.set({ ...t, zooming: false });
      return;
    }
    if (m === 'free' || busy.get()) return;

    const cut = first || (jumped && m === 'follow');
    const snap = cut || reduceMotion;
    // A cut puts the actor in the middle, not on the dead zone's edge.
    if (cut && m === 'follow') recentre.set(true);
    const ease = (rate: number) => {
      'worklet';
      return snap ? 1 : 1 - Math.exp(-rate * dt);
    };

    // Framing everyone: their box, with room for heads and bubbles.
    let targetScale = zoom.get();
    let frameX = 0;
    let frameY = 0;
    const framing = m === 'overview' || m === 'intro';
    if (framing) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const a of actors) {
        const p = focusPoint(a.motion);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.feetY - AVATAR_HEIGHT);
        maxY = Math.max(maxY, p.feetY);
      }
      const fit = Math.min(
        (width - 2 * OVERVIEW_PAD.side) / Math.max(1, maxX - minX),
        (visH - OVERVIEW_PAD.top - OVERVIEW_PAD.bottom) / Math.max(1, maxY - minY),
      );
      // Never further out than the whole room needs.
      const room = Math.min(width / (b.maxX - b.minX), visH / (b.maxY - b.minY));
      targetScale = Math.max(MIN_ZOOM, Math.min(OVERVIEW_MAX_ZOOM, Math.max(fit, room)));
      frameX = (minX + maxX) / 2;
      // Centred on the padded box, so bubbles above the heads fit.
      frameY = (minY - OVERVIEW_PAD.top / targetScale + maxY + OVERVIEW_PAD.bottom / targetScale) / 2;
    }

    const nextScale = s + (targetScale - s) * ease(ZOOM_RATE);
    const zoomed = Math.abs(nextScale - s) > 0.0005;
    if (zoomed) scale.set(nextScale);
    const ns = zoomed ? nextScale : s;
    if (zoomed && !framing) {
      // Zoom around whom the camera is on, so they stay put while the zoom changes.
      const who = m === 'focus' && focused ? focusPoint(focused.motion) : me;
      tx.set(who.x * s + tx.get() - who.x * ns);
      ty.set(who.y * s + ty.get() - who.y * ns);
    }
    const rangeX = offsetRange(b.minX, b.maxX, ns, width);
    const rangeY = offsetRange(b.minY, b.maxY, ns, visH);

    let targetX: number;
    let targetY: number;
    let rate = FOLLOW_RATE;
    if (framing) {
      targetX = width / 2 - frameX * ns;
      targetY = visH / 2 - frameY * ns;
      rate = OVERVIEW_RATE;
    } else {
      const who = m === 'focus' && focused ? focusPoint(focused.motion) : me;
      const centred = m === 'focus' || recentre.get();
      const aimX = who.x + (m === 'follow' ? t.vx * LOOKAHEAD_S : 0);
      const aimY = who.y + (m === 'follow' ? t.vy * LOOKAHEAD_S : 0);
      const zoneX: [number, number] = centred
        ? [width / 2, width / 2]
        : [width * DEAD_ZONE.left, width * DEAD_ZONE.right];
      const midY = visH * ((DEAD_ZONE.top + DEAD_ZONE.bottom) / 2);
      const zoneY: [number, number] = centred ? [midY, midY] : [visH * DEAD_ZONE.top, visH * DEAD_ZONE.bottom];
      // The offset that brings the aim point back inside the zone, or leaves it if it is.
      // With Reduce Motion the camera jumps a whole step to the middle instead of scrolling
      // along with the actor at the zone's edge.
      const into = (offset: number, aim: number, [lo, hi]: [number, number]) => {
        'worklet';
        const onScreen = aim * ns + offset;
        if (onScreen >= lo && onScreen <= hi) return offset;
        if (reduceMotion) return (lo + hi) / 2 - aim * ns;
        return (onScreen < lo ? lo : hi) - aim * ns;
      };
      targetX = into(tx.get(), aimX, zoneX);
      targetY = into(ty.get(), aimY, zoneY);
    }
    // Near an edge the target can't be reached; the camera stops at the edge.
    targetX = clampTo(targetX, rangeX);
    targetY = clampTo(targetY, rangeY);

    const k = ease(rate);
    const nextX = tx.get() + (targetX - tx.get()) * k;
    const nextY = ty.get() + (targetY - ty.get()) * k;
    if (Math.abs(nextX - tx.get()) > EPSILON) tx.set(nextX);
    if (Math.abs(nextY - ty.get()) > EPSILON) ty.set(nextY);

    if (recentre.get() && Math.abs(targetX - nextX) < SETTLED_PX && Math.abs(targetY - nextY) < SETTLED_PX
      && Math.abs(targetScale - ns) < 0.002) {
      recentre.set(false);
    }
  }, [actors, localActorId, origin, track, command, onChange, onZoom, mode, zoom, recentre, busy, bounds, inset,
    scale, tx, ty, width, height, reduceMotion]);

  useFrameCallback(onFrame);
}
