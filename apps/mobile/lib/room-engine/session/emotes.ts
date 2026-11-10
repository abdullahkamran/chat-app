import type { PropId } from '../core/contract';
import type { SoundId } from './sounds';

/**
 * What the session plays for each two-person emote. Keys are Animation catalog names
 * (apps/backend/src/catalog/animations.catalog.ts); clip names are the engine's
 * (engines/skia/skeleton/clips.ts, EMOTE_CLIPS). A catalog emote missing here does nothing.
 */

export interface MutualEmoteDef {
  /** Clip for the person who asked, and for the one who accepted. Same length. */
  initiatorClip: string;
  targetClip: string;
  /** How the shell phrases it: "Tap someone to {verb}", "{name} wants to {verb} you". */
  verb: string;
}

export interface InteractiveEmoteDef {
  prop: PropId;
  /** The thrower's clip; the prop leaves the hand `releaseMs` in. */
  throwClip: string;
  releaseMs: number;
  /** The target's clip when it lands, unless they are walking, seated or mid mutual emote. */
  reactClip: string;
  /** How long the splat stays on the target. */
  splatMs: number;
  throwSound?: SoundId;
  hitSound?: SoundId;
  /** "Tap someone to {verb}". */
  verb: string;
}

export const MUTUAL_EMOTES: Readonly<Record<string, MutualEmoteDef>> = {
  highFive: { initiatorClip: 'highFiveGive', targetClip: 'highFiveTake', verb: 'high five' },
  hug: { initiatorClip: 'hugGive', targetClip: 'hugTake', verb: 'hug' },
};

/** Throw clip release, matching THROW_RELEASE_S in clips.ts. */
const RELEASE_MS = 420;

export const INTERACTIVE_EMOTES: Readonly<Record<string, InteractiveEmoteDef>> = {
  throwTomato: {
    prop: 'tomato', throwClip: 'throw', releaseMs: RELEASE_MS, reactClip: 'hitReact', splatMs: 1600,
    throwSound: 'whoosh', hitSound: 'splat', verb: 'throw a tomato at',
  },
  throwSnowball: {
    prop: 'snowball', throwClip: 'throw', releaseMs: RELEASE_MS, reactClip: 'hitReact', splatMs: 900,
    throwSound: 'whoosh', hitSound: 'poof', verb: 'throw a snowball at',
  },
};

/** Clips played as half of a mutual emote; a thrown prop doesn't interrupt them. */
export const MUTUAL_CLIPS: ReadonlySet<string> = new Set(
  Object.values(MUTUAL_EMOTES).flatMap(d => [d.initiatorClip, d.targetClip]),
);

/**
 * Sounds attached to clips, `atMs` after the clip starts, for everyone in the room. Any
 * emote clip can have one: add it here. Thrown props' sounds are in INTERACTIVE_EMOTES,
 * since they follow the flight rather than the clip.
 */
export const CLIP_SOUNDS: Readonly<Record<string, { sound: SoundId; atMs: number }>> = {
  highFiveGive: { sound: 'highFive', atMs: 550 },
};

/** How long a thrown prop is in the air: longer for longer throws. */
export function flightMs(distanceCells: number): number {
  return Math.round(Math.min(900, Math.max(350, 300 + distanceCells * 90)));
}
