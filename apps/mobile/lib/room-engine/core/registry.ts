import { legacyEngine } from '../engines/legacy';
import type { RoomEngine } from './contract';

const ENGINES = {
  legacy: legacyEngine,
} satisfies Record<string, RoomEngine>;

export type RoomEngineId = keyof typeof ENGINES;

const DEFAULT_ENGINE: RoomEngineId = 'legacy';

// Must be read as a literal property access: Expo inlines EXPO_PUBLIC_* at bundle time.
// Restart Metro with a cleared cache (`expo start -c`) after changing it.
const requested = process.env.EXPO_PUBLIC_ROOM_ENGINE;

function isEngineId(id: string): id is RoomEngineId {
  return Object.prototype.hasOwnProperty.call(ENGINES, id);
}

/** The room engine selected by EXPO_PUBLIC_ROOM_ENGINE, falling back to legacy. */
export function getRoomEngine(): RoomEngine {
  if (requested && isEngineId(requested)) return ENGINES[requested];
  if (requested) {
    console.warn(`Unknown room engine "${requested}", using "${DEFAULT_ENGINE}"`);
  }
  return ENGINES[DEFAULT_ENGINE];
}
