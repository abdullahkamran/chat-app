import type { RoomEngine } from '../../core/contract';
import { SkiaRoomRenderer } from './SkiaRoomRenderer';

/**
 * Skia + Reanimated engine. Phase 1 shell: backdrop, items, camera, hit-testing and
 * edit grid are real; avatars are placeholder capsules until the skeletal rig lands.
 */
export const skiaEngine: RoomEngine = {
  id: 'skia',
  capabilities: {
    facings: 4,
    actions: ['idle', 'walk'],
    editMode: true,
  },
  Renderer: SkiaRoomRenderer,
};
