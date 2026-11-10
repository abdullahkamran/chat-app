import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useWalkabilityGrid } from '../core/useWalkabilityGrid';
import { STEER_LEAD_MS, STEER_MAX_DT, STEER_REPORT_MS } from './config';
import { makeSteerGrid, steerAhead, steerStep, stickToGrid } from './steerMath';

/** Coming down off a seat when steering away from it, like a walk's first step. */
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
}

/**
 * Engine side of the joystick: while the stick is pushed, moves the local actor's motion
 * every frame on the UI thread, sliding along furniture, and reports start, progress and
 * stop to the session. Returns whether it is steering now, during which the engine's own
 * walk animation must leave that actor alone.
 */
export function useSteerDriver({ steering, motion, dimensions, items, msPerCell }: Options): boolean {
  const [steered, setSteered] = useState(false);

  const { blockedCells } = useWalkabilityGrid(dimensions, items);
  const grid = useSharedValue(makeSteerGrid(dimensions.x, dimensions.y, blockedCells));
  useEffect(() => {
    grid.set(makeSteerGrid(dimensions.x, dimensions.y, blockedCells));
  }, [grid, dimensions.x, dimensions.y, blockedCells]);

  const cellsPerSecond = useSharedValue(1000 / msPerCell);
  useEffect(() => {
    cellsPerSecond.set(1000 / msPerCell);
  }, [cellsPerSecond, msPerCell]);

  const run = useSharedValue({ moving: false, sinceReport: 0 });

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
        run.set({ moving: false, sinceReport: 0 });
        scheduleOnRN(stop, motion.gx.get(), motion.gy.get());
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
    const dt = Math.min(STEER_MAX_DT, (frame.timeSincePreviousFrame ?? 16) / 1000);
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
    run.set({ moving: true, sinceReport });
  }, [stick, motion, run, grid, cellsPerSecond, start, move, stop]);

  useFrameCallback(onFrame);

  return steered;
}
