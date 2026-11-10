import type { RoomEngine } from '../../core/contract';
import { SkiaRoomRenderer } from './SkiaRoomRenderer';
import { SEATED_EMOTE_CLIPS } from './skeleton/clips';

/**
 * Skia + Reanimated engine: backdrop, items, camera, hit-testing, edit grid and skeletal
 * avatars that walk, sit and emote.
 */
export const skiaEngine: RoomEngine = {
  id: 'skia',
  capabilities: {
    facings: 4,
    actions: ['idle', 'walk', 'sit', 'emote'],
    seatedEmotes: SEATED_EMOTE_CLIPS,
    editMode: true,
  },
  Renderer: SkiaRoomRenderer,
};
