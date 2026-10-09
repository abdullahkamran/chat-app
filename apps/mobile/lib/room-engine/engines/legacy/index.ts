import type { RoomEngine } from '../../core/contract';
import { LegacyRoomRenderer } from './LegacyRoomRenderer';

/** The original View-based engine. Mirrors one sprite for left/right; no skeletal animation. */
export const legacyEngine: RoomEngine = {
  id: 'legacy',
  capabilities: {
    facings: 2,
    actions: ['idle', 'walk'],
    editMode: true,
  },
  Renderer: LegacyRoomRenderer,
};
