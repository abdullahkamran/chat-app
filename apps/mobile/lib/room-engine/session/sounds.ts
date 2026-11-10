import type { AudioPlayer } from 'expo-audio';

/**
 * Emote sound effects. The files are placeholders made by `scripts/emote-sounds.mjs`;
 * swap any for a real recording with the same name.
 */
const SOURCES = {
  highFive: require('../../../assets/sounds/high-five.wav'),
  splat: require('../../../assets/sounds/splat.wav'),
  poof: require('../../../assets/sounds/poof.wav'),
  whoosh: require('../../../assets/sounds/whoosh.wav'),
};

export type SoundId = keyof typeof SOURCES;

type ExpoAudio = typeof import('expo-audio');

/** Loaded on first use; null when the native module is missing (a dev build made before expo-audio). */
let audio: ExpoAudio | null | undefined;
const players = new Map<SoundId, AudioPlayer>();

function load(): ExpoAudio | null {
  if (audio !== undefined) return audio;
  try {
    // Required lazily so a build without the native module fails here, not at import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as ExpoAudio;
    // Short effects: mix with whatever else is playing, and stay quiet on silent mode.
    audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
      .catch(e => console.warn('[sounds] audio mode', e));
  } catch (e) {
    console.warn('[sounds] expo-audio is not in this build; emotes play silently', e);
    audio = null;
  }
  return audio;
}

/** Play a sound effect from the start, cutting off the same sound if it is still playing. */
export function playSound(id: SoundId): void {
  const lib = load();
  if (!lib) return;
  try {
    let player = players.get(id);
    if (!player) {
      player = lib.createAudioPlayer(SOURCES[id]);
      players.set(id, player);
    }
    player.seekTo(0).catch(() => {});
    player.play();
  } catch (e) {
    console.warn(`[sounds] could not play ${id}`, e);
  }
}
