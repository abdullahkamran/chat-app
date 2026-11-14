import { useEffect, useMemo, useState } from 'react';
import type { Dimensions, RoomItem } from '@chat-app/shared-types';
import type { RoomMode } from '../core/contract';
import { SLOT_MS, petTimelines, type PetState } from '../core/pets';
import { playSound } from './sounds';

/** Pets are background life: quieter than emotes. */
const PET_VOLUME = 0.45;

/**
 * The room's pets for the engine: their timelines around now, shifted onto this device's
 * clock, refreshed as each slot (core/pets.ts SLOT_MS) begins, with their sounds played
 * on time. Empty in edit mode, where pets are ordinary items.
 *
 * `clockOffsetMs` is the server's clock minus this device's (from the presence snapshot),
 * so every client's pets line up whatever its own clock says.
 */
export function usePets(items: RoomItem[], dimensions: Dimensions, mode: RoomMode, clockOffsetMs: number): PetState[] {
  const hasPets = mode === 'play' && items.some(ri => ri.itemId.pet && ri._id);

  // Bumped at each slot boundary, so the timelines move on.
  const [slot, setSlot] = useState(() => Math.floor((Date.now() + clockOffsetMs) / SLOT_MS));
  useEffect(() => {
    if (!hasPets) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const serverNow = Date.now() + clockOffsetMs;
      setSlot(Math.floor(serverNow / SLOT_MS));
      timer = setTimeout(schedule, SLOT_MS - (serverNow % SLOT_MS) + 20);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [hasPets, clockOffsetMs]);

  const { x: sizeX, y: sizeY } = dimensions;
  const pets = useMemo<PetState[]>(() => {
    if (!hasPets) return [];
    return petTimelines(items, { x: sizeX, y: sizeY, z: 0 }, slot * SLOT_MS).map(p => ({
      ...p,
      segments: p.segments.map(s => ({ ...s, start: s.start - clockOffsetMs, end: s.end - clockOffsetMs })),
    }));
  }, [hasPets, items, sizeX, sizeY, slot, clockOffsetMs]);

  // Sounds due before the next refresh. Each refresh replaces the last one's timers and only
  // schedules sounds still ahead, so none plays twice.
  useEffect(() => {
    if (!pets.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    const until = now + SLOT_MS + 100;
    for (const pet of pets) {
      for (const s of pet.segments) {
        if (!s.sound || s.start < now || s.start >= until) continue;
        const sound = s.sound;
        timers.push(setTimeout(() => playSound(sound, PET_VOLUME), s.start - now));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [pets]);

  return pets;
}
