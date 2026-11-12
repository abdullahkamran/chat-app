import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelAnimation,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Dimensions, RoomItem } from '@chat-app/shared-types';
import type { SteeringInput } from '../core/contract';
import { findSeat, standingSpot, type SitAction } from '../core/seats';
import { useWalkabilityGrid } from '../core/useWalkabilityGrid';
import { STEER_LEAD_MS, STEER_MAX_DT, STEER_REPORT_MS } from './config';
import { fits, freeSpot, makeSteerGrid, steerAhead, steerStep, stickToGrid } from './steerMath';

/** Coming down off a seat (and stepping off its furniture) when steering away from it, like a walk's first step. */
const SETTLE_MS = 350;

/** The animated position an engine draws an actor at. */
interface Motion {
  gx: SharedValue<number>;
  gy: SharedValue<number>;
  gz: SharedValue<number>;
}

interface Options {
  steering: SteeringInput | undefined;
  /** The local actor's motion; undefined until it is in the room. */
  motion: Motion | undefined;
  dimensions: Dimensions;
  items: RoomItem[];
  /** The local actor's walking pace, so steering and tap-to-walk move at the same speed. */
  msPerCell: number;
  /** The seat the local actor sits on, if any: steering gets up off its front first. */
  seat: SitAction | undefined;
}

/**
 * Engine side of the joystick: while the stick is pushed, moves the local actor's motion
 * every frame on the UI thread, sliding along furniture, and reports start, progress and
 * stop to the session. Returns whether it is steering now, during which the engine's own
 * walk animation must leave that actor alone.
 */
export function useSteerDriver({ steering, motion, dimensions, items, msPerCell, seat }: Options): boolean {
  const [steered, setSteered] = useState(false);

  const { blockedCells } = useWalkabilityGrid(dimensions, items);
  const grid = useSharedValue(makeSteerGrid(dimensions.x, dimensions.y, blockedCells));
  useEffect(() => {
    grid.set(makeSteerGrid(dimensions.x, dimensions.y, blockedCells));
  }, [grid, dimensions.x, dimensions.y, blockedCells]);

  // Where getting up from the current seat lands: the floor in front of it, as when sitting
  // down. Read on the first steering frame, before the session swaps the sit for a walk.
  const seatSpot = useMemo(() => {
    const found = seat && findSeat(items, seat);
    if (!found) return null;
    const free = (gx: number, gy: number) =>
      gx >= 0 && gy >= 0 && gx < dimensions.x && gy < dimensions.y && !blockedCells.has(`${gx},${gy}`);
    const spot = standingSpot(found.item, found.seat, free);
    return { x: spot.gx, y: spot.gy };
  }, [seat, items, blockedCells, dimensions.x, dimensions.y]);
  const exit = useSharedValue<{ x: number; y: number } | null>(seatSpot);
  useEffect(() => {
    exit.set(seatSpot);
  }, [exit, seatSpot]);

  const cellsPerSecond = useSharedValue(1000 / msPerCell);
  useEffect(() => {
    cellsPerSecond.set(1000 / msPerCell);
  }, [cellsPerSecond, msPerCell]);

  // hopLeft > 0 while stepping off furniture onto (hopX, hopY), before steering takes over.
  const run = useSharedValue({ moving: false, sinceReport: 0, hopLeft: 0, hopX: 0, hopY: 0 });

  // The session's callbacks change every render; the frame callback must not, or it re-registers.
  const latest = useRef(steering);
  useEffect(() => {
    latest.current = steering;
  });
  const start = useCallback(() => {
    setSteered(true);
    latest.current?.onStart();
  }, []);
  const move = useCallback((x: number, y: number, aheadX: number, aheadY: number) => {
    latest.current?.onMove({ x, y }, { x: aheadX, y: aheadY });
  }, []);
  const stop = useCallback((x: number, y: number) => {
    setSteered(false);
    latest.current?.onStop({ x, y });
  }, []);

  const stick = steering?.stick;
  const onFrame = useCallback((frame: FrameInfo) => {
    'worklet';
    if (!stick || !motion) return;
    const s = stick.get();
    const state = run.get();

    if (s.x === 0 && s.y === 0) {
      if (state.moving) {
        // Let a hop off furniture finish, and stop where it lands rather than inside the furniture.
        const hopping = state.hopLeft > 0;
        run.set({ moving: false, sinceReport: 0, hopLeft: 0, hopX: 0, hopY: 0 });
        scheduleOnRN(stop, hopping ? state.hopX : motion.gx.get(), hopping ? state.hopY : motion.gy.get());
      }
      return;
    }

    let sinceReport = state.sinceReport;
    if (!state.moving) {
      // Take over from any walk or seat. Assigning gx/gy below also stops their animations,
      // but cancelling first keeps a walk's completion callback from firing.
      cancelAnimation(motion.gx);
      cancelAnimation(motion.gy);
      if (motion.gz.get() !== 0) motion.gz.set(withTiming(0, { duration: SETTLE_MS }));
      scheduleOnRN(start);
      // Report on the first frame, so others see us set off at once.
      sinceReport = STEER_REPORT_MS;
    }

    const g = grid.get();
    const dir = stickToGrid(s.x, s.y);
    const frameMs = frame.timeSincePreviousFrame ?? 16;

    if (state.hopLeft > 0) {
      run.set({ ...state, moving: true, hopLeft: state.hopLeft - frameMs });
      return;
    }
    // Inside furniture: step off before steering, never through it. Getting up from a seat
    // lands in front of it, as sitting down started there; otherwise (furniture placed on
    // us) the nearest free floor, leaning toward the stick.
    if (!fits(g, motion.gx.get(), motion.gy.get())) {
      const e = exit.get();
      const spot = e && fits(g, e.x, e.y) ? e : freeSpot(g, motion.gx.get(), motion.gy.get(), dir);
      if (spot) {
        motion.gx.set(withTiming(spot.x, { duration: SETTLE_MS }));
        motion.gy.set(withTiming(spot.y, { duration: SETTLE_MS }));
        scheduleOnRN(move, spot.x, spot.y, spot.x, spot.y);
        run.set({ moving: true, sinceReport: 0, hopLeft: SETTLE_MS, hopX: spot.x, hopY: spot.y });
      } else {
        run.set({ ...state, moving: true, sinceReport });
      }
      return;
    }

    const dt = Math.min(STEER_MAX_DT, frameMs / 1000);
    const distance = cellsPerSecond.get() * dt;
    const p = steerStep(g, motion.gx.get(), motion.gy.get(), dir.dx * distance, dir.dy * distance);
    motion.gx.set(p.x);
    motion.gy.set(p.y);

    sinceReport += dt * 1000;
    if (sinceReport >= STEER_REPORT_MS) {
      const ahead = steerAhead(g, p.x, p.y, dir, (cellsPerSecond.get() * STEER_LEAD_MS) / 1000);
      scheduleOnRN(move, p.x, p.y, ahead.x, ahead.y);
      sinceReport = 0;
    }
    run.set({ moving: true, sinceReport, hopLeft: 0, hopX: 0, hopY: 0 });
  }, [stick, motion, run, grid, exit, cellsPerSecond, start, move, stop]);

  useFrameCallback(onFrame);

  return steered;
}
