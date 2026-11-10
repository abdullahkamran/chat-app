import type { RoomEngine } from '../../core/contract';
import { SkiaRoomRenderer } from './SkiaRoomRenderer';

/**
 * Skia + Reanimated engine: backdrop, items, camera, hit-testing, edit grid and skeletal
 * avatars that walk, sit and emote.
 */
export const skiaEngine: RoomEngine = {
  id: 'skia',
  capabilities: {
    facings: 4,
    actions: ['idle', 'walk', 'sit', 'emote'],
    editMode: true,
  },
  Renderer: SkiaRoomRenderer,
};
