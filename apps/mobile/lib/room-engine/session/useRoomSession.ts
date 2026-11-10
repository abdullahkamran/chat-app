import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth.context';
import { useUserInfo } from '@/context/user.context';
import { useChat } from '@/hooks/useChat';
import { useInventory } from '@/hooks/useInventory';
import { api } from '@/lib/api';
import { isMirrored, type GridPoint } from '@/constants/grid';
import {
  EmoteType,
  Facing,
  ItemAction,
  ItemPlacement,
  ItemState,
  Orientiation,
  themeSlotsOf,
  type ActorAction,
  type ActorActionKind,
  type Avatar,
  type Item,
  type ItemSeat,
  type MutualEmoteEndReason,
  type MutualEmoteRequest,
  type MutualEmoteRequestEnded,
  type MutualEmoteStart,
  type Position,
  type RoomInteraction,
  type RoomItem,
  type RoomOccupant,
  type RoomPresenceState,
  type RoomTheme,
  type User,
} from '@chat-app/shared-types';
import type { ActorState, EditState, EngineCapabilities, FloorPoint, RoomEffect, RoomMode, RoomScene } from '../core/contract';
import { fitsAt, itemCovering } from '../core/editLayout';
import { facingFromDelta } from '../core/facing';
import { findSeat, itemSeats, sameSeat, seatApproach, seatPosition, type SitAction } from '../core/seats';
import { findPath, isLineClear, nearestReachableCell, smoothPath } from '../core/usePathfinding';
import { useWalkabilityGrid } from '../core/useWalkabilityGrid';
import { useRoomDetails } from '../hooks/useRoomDetails';
import {
  CLIP_SOUNDS,
  INTERACTIVE_EMOTES,
  MUTUAL_CLIPS,
  MUTUAL_EMOTES,
  flightMs,
  type InteractiveEmoteDef,
} from './emotes';
import { playSound } from './sounds';

type EmoteAction = Extract<ActorAction, { kind: 'emote' }>;

/** One person's half of an accepted mutual emote, while the two walk to their spots. */
interface MutualPart {
  requestId: string;
  partnerId: User['_id'];
  clip: string;
  /** Towards the partner's spot. */
  facing: Facing;
  arrived: boolean;
}

/** A mutual emote or interactive emote waiting for the user to tap whom it is for. */
export interface EmotePicking {
  animation: string;
  type: typeof EmoteType.MUTUAL | typeof EmoteType.INTERACTIVE;
}

/** A short word about a mutual emote request that ended without starting. */
export interface EmoteNotice {
  id: number;
  reason: MutualEmoteEndReason;
  /** The other person. */
  userId: User['_id'];
  animation: string;
  /** Whether we asked (else we were asked and had accepted). */
  asked: boolean;
}

/** A pair still not both at their spots this long after accepting gives up. */
const MUTUAL_GIVE_UP_MS = 20_000;
/** How long a notice about a request shows. */
const EMOTE_NOTICE_MS = 3500;
/** Logical positions closer than this are the same spot. */
const SAME_SPOT = 1e-6;

/** A typing bubble stays this long after the last keystroke report. */
const TYPING_SHOW_MS = 2500;
/** At most one typing report per this interval while the user types. */
const TYPING_SEND_MS = 1500;
/** The transcript keeps this many of the latest messages. */
const TRANSCRIPT_MAX = 50;
/** A message seen late this close to one already in the transcript is the same message. */
const TRANSCRIPT_SAME_MS = 3000;

/** One line of the room's chat transcript. */
export interface TranscriptEntry {
  id: string;
  userId: User['_id'];
  text: string;
  /** When it was sent, by this device's clock; earlier for one seen late, from the presence snapshot. */
  sentAt: number;
}

/**
 * Engine-agnostic room state: socket events, characters, chat and edit mode.
 * Engines render what this returns and report user intents back through `intents`.
 * Actions the engine can't play (`capabilities.actions`) are skipped on this device.
 */
export function useRoomSession(roomId: string, capabilities: EngineCapabilities) {
  const { data: roomDetails, isLoading, error } = useRoomDetails(roomId);
  const queryClient = useQueryClient();
  const { data: inventoryItems = [] } = useInventory();
  const [actors, setActors] = useState<Record<User['_id'], ActorState>>({});
  // Remote actors' avatars by user id. The local actor's comes from auth.
  const [avatars, setAvatars] = useState<Record<User['_id'], Avatar>>({});
  // Latest avatar request per user; a response to an older one is dropped.
  const avatarRequestRef = useRef<Record<User['_id'], number>>({});
  // Seats actors are walking to; each becomes a `sit` action when its walk completes.
  const pendingSitRef = useRef<Record<User['_id'], SitAction>>({});
  // Emotes sent while their actor was walking; each plays when the walk completes.
  const pendingEmoteRef = useRef<Record<User['_id'], EmoteAction>>({});
  // Each actor's latest walk number, and the number of each walk action, so a completion
  // report for a walk that has since been replaced is recognised as stale.
  const walkSeqRef = useRef<Record<User['_id'], number>>({});
  const [walkIds] = useState(() => new WeakMap<ActorAction, number>());
  // Whether the server has told us who was here when we entered. Until then, an empty room may not be.
  const [presenceKnown, setPresenceKnown] = useState(false);
  const canEmote = capabilities.actions.includes('emote');

  // Two-person emotes. `picking`: chosen in the drawer, waiting for a tap on someone.
  // `outgoing`: our request, until answered. `incoming`: requests to us, oldest first.
  const [picking, setPicking] = useState<EmotePicking | null>(null);
  const [outgoing, setOutgoing] = useState<MutualEmoteRequest | null>(null);
  const [incoming, setIncoming] = useState<MutualEmoteRequest[]>([]);
  const [emoteNotice, setEmoteNotice] = useState<EmoteNotice | null>(null);
  const noticeSeqRef = useRef(0);
  // A request we accepted, until it starts: if it can't, we are told why.
  const acceptedRef = useRef<MutualEmoteRequest | null>(null);
  // Halves of accepted mutual emotes whose people are still walking to their spots.
  const mutualRef = useRef<Record<User['_id'], MutualPart>>({});
  // Per throw action: whom it is thrown at and how. Per emote action: whom to turn to first.
  const [throwOf] = useState(() => new WeakMap<ActorAction, { targetId: string; def: InteractiveEmoteDef }>());
  const [faceTargetOf] = useState(() => new WeakMap<ActorAction, User['_id']>());
  // Emote actions whose start (sounds, thrown props) has been handled.
  const [startedEmotes] = useState(() => new WeakSet<ActorAction>());
  const [effects, setEffects] = useState<RoomEffect[]>([]);
  const effectSeqRef = useRef(0);
  // Timers for sounds, throws and notices; cleared when the room closes.
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  const { user } = useUserInfo();
  const { selectedAvatar } = useAuth();
  const userId = user?.userId ?? '';

  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Usernames from typing events, for the "is typing" line.
  const [typingNames, setTypingNames] = useState<Record<User['_id'], string>>({});
  // Whether a typing report went out within the last TYPING_SEND_MS.
  const typingSentRef = useRef(false);
  const bubbleIdRef = useRef(0);
  // Messages seen since entering, oldest first, including those still up when we came in.
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Edit mode
  const [mode, setMode] = useState<RoomMode>('play');
  const isEditMode = mode === 'edit';
  const [pendingItems, setPendingItems] = useState<RoomItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<RoomItem | null>(null);
  // Wallpapers and floorings applied while editing; saved with the items.
  const [pendingTheme, setPendingTheme] = useState<RoomTheme | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = roomDetails?.ownerId === userId;

  const roomDimensions = {
    x: roomDetails?.dimensions?.x || 8,
    y: roomDetails?.dimensions?.y || 6,
    z: 0,
  };

  const { isWalkable } = useWalkabilityGrid(
    roomDimensions,
    roomDetails?.items ?? [],
  );

  const {
    moveMe, sendMessage, sendTyping, sendAction, sendEmoteRequest, cancelEmoteRequest: sendEmoteRequestCancel,
    respondToEmoteRequest, sendInteraction,
  } = useChat({
    roomId,
    userId,
    handlers: {
      onEnter: receiveEnter,
      onPresence: receivePresence,
      onSitRefused: receiveSitRefused,
      onExit: receiveExit,
      onPoint: receivePoint,
      onMessage: receiveMessage,
      onTyping: receiveTyping,
      onAvatarChanged: receiveAvatarChanged,
      onAction: receiveAction,
      onItemsChanged: receiveItemsChanged,
      onEmoteRequest: receiveEmoteRequest,
      onEmoteRequestEnded: receiveEmoteRequestEnded,
      onMutualEmote: receiveMutualEmote,
      onInteraction: receiveInteraction,
    },
    // Doors and seats must be known before occupants can be placed.
    enabled: !!roomDetails,
    getMyState: () => {
      const me = actors[userId];
      if (!me) return {};
      const position = { x: me.position.x, y: me.position.y };
      const seat = seatOf(me);
      return seat ? { position, action: seat } : { position };
    },
    onEnterMe: () => enterCharacter(userId ?? ''),
    onReconnect: dropRemoteActors,
  });

  function dropRemoteActors() {
    setActors(current => (current[userId] ? { [userId]: current[userId] } : {}));
    setTypingUserIds(new Set());
    for (const uid of Object.keys(avatarRequestRef.current)) forgetAvatar(uid);
    pendingSitRef.current = pendingSitRef.current[userId] ? { [userId]: pendingSitRef.current[userId] } : {};
    pendingEmoteRef.current = {};
    // The server ended our requests when the old socket went; nothing two-person carries over.
    mutualRef.current = {};
    acceptedRef.current = null;
    setOutgoing(null);
    setIncoming([]);
    setEffects([]);
  }

  /** Run `fn` after `ms`, unless the room closes first. */
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      fn();
    }, ms);
    timersRef.current.add(timer);
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  // Actors as of the last render, for timers that fire later.
  const actorsRef = useRef(actors);
  useEffect(() => {
    actorsRef.current = actors;
  });

  /** Show what happened to a request for a few seconds. */
  function showEmoteNotice(notice: Omit<EmoteNotice, 'id'>) {
    const id = ++noticeSeqRef.current;
    setEmoteNotice({ ...notice, id });
    later(() => setEmoteNotice(current => (current?.id === id ? null : current)), EMOTE_NOTICE_MS);
  }

  /** A mutual emote request: ours (the server's echo, carrying its id) or one asking us. */
  function receiveEmoteRequest(request: MutualEmoteRequest) {
    if (request.fromUserId === userId) {
      setOutgoing(request);
    } else if (request.toUserId === userId) {
      // A newer request from the same person replaces theirs.
      setIncoming(list => [...list.filter(r => r.fromUserId !== request.fromUserId), request]);
    }
  }

  /** A request we made or were asked ended without starting. */
  function receiveEmoteRequestEnded({ requestId, reason }: MutualEmoteRequestEnded) {
    setIncoming(list => list.filter(r => r.requestId !== requestId));
    if (outgoing?.requestId === requestId) {
      setOutgoing(null);
      // Withdrawing (or asking someone else instead) needs no word.
      if (reason !== 'cancelled') {
        showEmoteNotice({ reason, userId: outgoing.toUserId, animation: outgoing.animation, asked: true });
      }
    }
    const accepted = acceptedRef.current;
    if (accepted?.requestId === requestId) {
      acceptedRef.current = null;
      showEmoteNotice({ reason, userId: accepted.fromUserId, animation: accepted.animation, asked: false });
    }
  }

  /**
   * A mutual emote was accepted (anyone's, not only ours). Both walk to the spots the server
   * chose, standing up first if seated; each turns to the other on arrival, and once both
   * are there both play their part. Either walking off on the way calls it off.
   */
  function receiveMutualEmote({ requestId, animation, initiatorId, targetId, initiatorAt, targetAt }: MutualEmoteStart) {
    setOutgoing(current => (current?.requestId === requestId ? null : current));
    setIncoming(list => list.filter(r => r.requestId !== requestId));
    if (acceptedRef.current?.requestId === requestId) acceptedRef.current = null;
    const def = MUTUAL_EMOTES[animation];
    const halves = [
      { uid: initiatorId, at: initiatorAt, partnerId: targetId, partnerAt: targetAt, clip: def?.initiatorClip },
      { uid: targetId, at: targetAt, partnerId: initiatorId, partnerAt: initiatorAt, clip: def?.targetClip },
    ];
    // Both walks first: a new destination ends any mutual emote its walker was part of.
    const arrived: Record<string, boolean> = {};
    for (const h of halves) arrived[h.uid] = goTo(h.uid, h.at);
    if (!def || !canEmote) return;
    for (const h of halves) {
      mutualRef.current[h.uid] = {
        requestId,
        partnerId: h.partnerId,
        clip: h.clip!,
        facing: facingFromDelta(h.partnerAt.x - h.at.x, h.partnerAt.y - h.at.y),
        arrived: arrived[h.uid],
      };
    }
    later(() => endMutual(requestId), MUTUAL_GIVE_UP_MS);
    tryStartMutual(requestId);
  }

  /**
   * Send an actor to a spot for a mutual emote. True when it is already standing there.
   * Someone not on screen yet is placed there directly.
   */
  function goTo(uid: string, at: { x: number; y: number }): boolean {
    const actor = actors[uid];
    if (!actor) {
      placeActor(uid, { position: at });
      return true;
    }
    const there = Math.abs(actor.position.x - at.x) < SAME_SPOT && Math.abs(actor.position.y - at.y) < SAME_SPOT;
    if (there && actor.action.kind !== 'sit') {
      // Already there, or already walking there (an accepting target who just stood up).
      clearMutual(uid);
      delete pendingEmoteRef.current[uid];
      return actor.action.kind !== 'walk';
    }
    setActorDestination(uid, at.x, at.y);
    return false;
  }

  /** Start the pair's emote once both have arrived; meanwhile whoever is there turns to face the other. */
  function tryStartMutual(requestId: string) {
    const halves = Object.entries(mutualRef.current).filter(([, part]) => part.requestId === requestId);
    if (halves.length !== 2 || !halves.every(([, part]) => part.arrived)) {
      for (const [uid, part] of halves) {
        if (part.arrived) {
          setActors(current => {
            const a = current[uid];
            return a && a.action.kind !== 'walk' ? { ...current, [uid]: { ...a, facing: part.facing } } : current;
          });
        }
      }
      return;
    }
    for (const [uid] of halves) delete mutualRef.current[uid];
    setActors(current => {
      const next = { ...current };
      for (const [uid, part] of halves) {
        const a = current[uid];
        if (a) next[uid] = { ...a, facing: part.facing, action: { kind: 'emote', animation: part.clip } };
      }
      return next;
    });
  }

  /** Call off whatever is left of a mutual emote. */
  function endMutual(requestId: string) {
    for (const [uid, part] of Object.entries(mutualRef.current)) {
      if (part.requestId === requestId) delete mutualRef.current[uid];
    }
  }

  /** The actor's mutual emote (if any) is off, for both of the pair. */
  function clearMutual(uid: string) {
    const part = mutualRef.current[uid];
    if (part) endMutual(part.requestId);
  }

  /** Someone threw something at someone. */
  function receiveInteraction({ userId: uid, targetId, animation }: RoomInteraction) {
    enterCharacter(uid);
    throwAt(uid, targetId, animation);
  }

  /**
   * Play an interactive emote: the thrower turns to the target and throws (after its walk,
   * when walking). The prop flies when the clip reaches its release; see the effect above.
   */
  function throwAt(uid: string, targetId: string, animation: string) {
    const def = INTERACTIVE_EMOTES[animation];
    if (!def || !canEmote) return;
    const action: EmoteAction = { kind: 'emote', animation: def.throwClip };
    throwOf.set(action, { targetId, def });
    faceTargetOf.set(action, targetId);
    playEmote(uid, action);
  }

  /** The prop leaves the thrower's hand: it flies, lands, and its splat stays a while. */
  function release(throwerId: string, targetId: string, def: InteractiveEmoteDef) {
    const from = actorsRef.current[throwerId];
    const to = actorsRef.current[targetId];
    if (!from || !to) return;
    if (def.throwSound) playSound(def.throwSound);
    const flight = flightMs(Math.hypot(to.position.x - from.position.x, to.position.y - from.position.y));
    const id = `throw-${effectSeqRef.current++}`;
    setEffects(list => [...list, { id, kind: 'throw', prop: def.prop, fromId: throwerId, toId: targetId, flightMs: flight, splatMs: def.splatMs }]);
    later(() => land(targetId, def), flight);
    later(() => setEffects(list => list.filter(e => e.id !== id)), flight + def.splatMs);
  }

  /** The prop hits: its sound, and the target flinches if standing free. */
  function land(targetId: string, def: InteractiveEmoteDef) {
    if (!actorsRef.current[targetId]) return;
    if (def.hitSound) playSound(def.hitSound);
    if (mutualRef.current[targetId]) return;
    setActors(current => {
      const t = current[targetId];
      if (!t || t.action.kind === 'walk' || t.action.kind === 'sit') return current;
      if (t.action.kind === 'emote' && MUTUAL_CLIPS.has(t.action.animation)) return current;
      return { ...current, [targetId]: { ...t, action: { kind: 'emote', animation: def.reactClip } } };
    });
  }

  // An emote action has just started on someone: schedule its sound and, for a throw, the
  // prop leaving the hand. Each only if that action is still playing by then. Emotes seen
  // partway through (joined mid-emote) stay silent.
  useEffect(() => {
    for (const actor of Object.values(actors)) {
      const action = actor.action;
      if (action.kind !== 'emote' || startedEmotes.has(action)) continue;
      startedEmotes.add(action);
      if (action.elapsedMs) continue;
      const stillPlaying = () => actorsRef.current[actor.id]?.action === action;
      const sound = CLIP_SOUNDS[action.animation];
      if (sound) later(() => stillPlaying() && playSound(sound.sound), sound.atMs);
      const thrown = throwOf.get(action);
      if (thrown) later(() => stillPlaying() && release(actor.id, thrown.targetId, thrown.def), thrown.def.releaseMs);
    }
  });

  function receiveEnter({ userId, ...state }: { userId: string } & RoomPresenceState) {
    // A re-entry after their reconnect: they are already somewhere in the room.
    if (state.position || state.action) {
      placeActor(userId, state);
      return;
    }
    // Users often change outfit between visits, so entering always refetches.
    if (actors[userId]) fetchAvatar(userId);
    enterCharacter(userId);
  }

  /** Everyone already in the room when we entered. They appear where they are, not at the door. */
  function receivePresence({ occupants }: { occupants: RoomOccupant[] }) {
    setPresenceKnown(true);
    for (const { userId: uid, bubbles = [], ...state } of occupants) {
      placeActor(uid, state);
      // Bubbles still up show for the time they have left.
      for (const b of bubbles) pushChatMessage(uid, b.text, b.elapsedMs);
    }
  }

  /**
   * Someone else took the seat first. Stay standing in front of it; if the walk already
   * ended and we sat down, stand up. Then tell the room where we stand, as it never saw the sit.
   */
  function receiveSitRefused({ action }: { action: SitAction }) {
    const me = actors[userId];
    const found = findSeat(roomDetails?.items ?? [], action);
    if (!me || !found) return;
    const spot = standingSpot(found.item, found.seat);
    const pending = pendingSitRef.current[userId];
    if (pending && sameSeat(pending, action)) {
      delete pendingSitRef.current[userId];
    } else if (me.action.kind === 'sit' && sameSeat(me.action, action)) {
      setActorDestination(userId, spot.gx, spot.gy);
    } else {
      return;
    }
    moveMe(spot.gx, spot.gy);
  }

  /**
   * The owner saved a new layout. The server stood everyone up and moved anyone furniture
   * now covers (see announceRoomItemsChanged); `placed` is where. They appear there at
   * once, standing, us included: a walk would be planned on the old layout still on
   * screen. Then load the new layout.
   */
  function receiveItemsChanged({ placed }: { placed: { userId: string; x: number; y: number }[] }) {
    const at = new Map(placed.map(p => [p.userId, { x: p.x, y: p.y, z: 0 }]));
    for (const uid of at.keys()) {
      delete pendingSitRef.current[uid];
      delete pendingEmoteRef.current[uid];
      clearMutual(uid);
    }
    setActors(current => {
      const next = { ...current };
      for (const [uid, position] of at) {
        const actor = current[uid];
        if (actor) next[uid] = { ...actor, position, action: { kind: 'idle' } };
      }
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ['roomDetails', roomId] });
  }

  function receiveExit({ userId }: { userId: string }) {
    exitCharacter(userId);
  }

  function receiveAvatarChanged({ userId }: { userId: string }) {
    if (actors[userId]) fetchAvatar(userId);
  }

  /** Fetch a remote user's selected avatar; the old one stays on screen until it arrives. */
  function fetchAvatar(uid: string) {
    if (!uid || uid === userId) return;
    const request = (avatarRequestRef.current[uid] ?? 0) + 1;
    avatarRequestRef.current[uid] = request;
    api.get<Avatar>(`/api/v1/users/${uid}/avatar`)
      .then(avatar => {
        if (avatarRequestRef.current[uid] !== request || !avatar) return;
        setAvatars(current => ({ ...current, [uid]: avatar }));
      })
      .catch(err => console.warn(`[room session] no avatar for ${uid}`, err));
  }

  /** Drop a user's avatar and ignore any response still in flight. */
  function forgetAvatar(uid: string) {
    avatarRequestRef.current[uid] = (avatarRequestRef.current[uid] ?? 0) + 1;
    setAvatars(current => {
      if (!current[uid]) return current;
      const { [uid]: _, ...rest } = current;
      return rest;
    });
  }

  function receivePoint({ userId, x, y }: { userId: string; x: number; y: number }) {
    // Only an enter brings someone in through the door; anyone else unseen is placed directly.
    if (!actors[userId]) {
      placeActor(userId, { position: { x, y } });
      return;
    }
    setActorDestination(userId, x, y);
  }

  function receiveAction({ userId, action }: { userId: string; action: ActorAction }) {
    if (action.kind === 'sit') {
      if (!actors[userId]) {
        placeActor(userId, { action });
        return;
      }
      walkToSeat(userId, action);
    } else if (action.kind === 'emote') {
      enterCharacter(userId);
      playEmote(userId, action);
    }
  }

  function receiveMessage({ userId, message }: { userId: string; message: string }) {
    enterCharacter(userId);
    stopTyping(userId);
    pushChatMessage(userId, message);
  }

  function receiveTyping({ userId, username }: { userId: string; username?: string }) {
    enterCharacter(userId);
    if (username) setTypingNames(names => (names[userId] === username ? names : { ...names, [userId]: username }));
    markTyping(userId);
  }

  /** Show someone's typing bubble until TYPING_SHOW_MS after their last keystroke report. */
  function markTyping(uid: string) {
    setTypingUserIds(prev => (prev.has(uid) ? prev : new Set(prev).add(uid)));
    clearTimeout(typingTimeoutRef.current[uid]);
    typingTimeoutRef.current[uid] = setTimeout(() => stopTyping(uid), TYPING_SHOW_MS);
  }

  function stopTyping(uid: string) {
    clearTimeout(typingTimeoutRef.current[uid]);
    setTypingUserIds(prev => {
      if (!prev.has(uid)) return prev;
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  }

  /** Where people come in: the entry door. */
  function doorPosition(): Position {
    const spawnDoor = roomDetails?.doors?.find(d => d.isEntry);
    return spawnDoor
      ? { x: spawnDoor.position.x, y: spawnDoor.position.y, z: 0 }
      : { x: 0, y: 0, z: 0 };
  }

  function newActor(uid: string, position: Position): ActorState {
    return {
      id: uid,
      user: { _id: uid } as User,
      position,
      facing: Facing.SE,
      action: { kind: 'idle' },
      bubbles: [],
      isTyping: false,
    };
  }

  function enterCharacter(uid: string) {
    if (actors[uid]) return;
    fetchAvatar(uid);
    const actor = newActor(uid, doorPosition());
    // `actors` is from the last render: an actor placed since (say by the presence snapshot,
    // just before this event in the same batch) must not be replaced by one at the door.
    setActors(current => (current[uid] ? current : { ...current, [uid]: actor }));
  }

  /**
   * Show a remote user where they already are, with no walk from the door: on their seat,
   * at their point (partway through an emote if one is playing), or at the door when they
   * haven't moved since entering.
   */
  function placeActor(uid: string, { position, action }: RoomPresenceState) {
    if (!uid || uid === userId) return;
    fetchAvatar(uid);
    delete pendingSitRef.current[uid];
    delete pendingEmoteRef.current[uid];
    clearMutual(uid);
    const seat = action?.kind === 'sit' ? findSeat(roomDetails?.items ?? [], action) : null;
    const at = seat
      ? seatPosition(seat.item, seat.seat)
      : position ? { x: position.x, y: position.y, z: 0 } : doorPosition();
    let next: ActorAction = { kind: 'idle' };
    if (seat && action) next = action;
    else if (action?.kind === 'emote' && canEmote) next = action;
    setActors(current => {
      const actor = current[uid] ?? newActor(uid, at);
      return {
        ...current,
        [uid]: { ...actor, position: at, facing: seat ? seat.seat.facing : actor.facing, action: next },
      };
    });
  }

  function exitCharacter(uid: string) {
    forgetAvatar(uid);
    delete pendingSitRef.current[uid];
    delete pendingEmoteRef.current[uid];
    clearMutual(uid);
    setActors(current => {
      const { [uid]: _, ...rest } = current;
      return rest;
    });
  }

  /** `elapsedMs` is how long ago it was sent, for a message seen late. */
  function pushChatMessage(uid: string, message: string, elapsedMs = 0) {
    const bubble = { id: `${bubbleIdRef.current++}`, text: message, sentAt: Date.now() - elapsedMs };
    // Sorted, since the presence snapshot's messages come in per occupant, not in the order sent.
    // A reconnect's snapshot repeats messages already here: their send times differ only by clock drift.
    setTranscript(current => {
      const seen = elapsedMs > 0 && current.some(e =>
        e.userId === uid && e.text === message && Math.abs(e.sentAt - bubble.sentAt) < TRANSCRIPT_SAME_MS);
      if (seen) return current;
      return [...current, { ...bubble, userId: uid }].sort((a, b) => a.sentAt - b.sentAt).slice(-TRANSCRIPT_MAX);
    });
    setActors(current => {
      const actor = current[uid];
      if (!actor) return current;
      return { ...current, [uid]: { ...actor, bubbles: [...actor.bubbles, bubble] } };
    });
  }

  /** The grid cell a floor position belongs to. Cells are centred on grid vertices, like items and edit cells. */
  function cellOf(x: number, y: number): GridPoint {
    return {
      gx: Math.max(0, Math.min(roomDimensions.x - 1, Math.round(x))),
      gy: Math.max(0, Math.min(roomDimensions.y - 1, Math.round(y))),
    };
  }

  /**
   * Where a walk from `from` toward (x, y) ends: (x, y) itself, kept inside its cell, when
   * that cell is free and reachable; otherwise the centre of the nearest cell that is.
   * Nobody walks into furniture.
   */
  function resolveDestination(from: Position, x: number, y: number): Position {
    const goal = cellOf(x, y);
    const end = nearestReachableCell(cellOf(from.x, from.y), goal, isWalkable);
    if (end.gx !== goal.gx || end.gy !== goal.gy) return { x: end.gx, y: end.gy, z: 0 };
    return {
      x: Math.max(goal.gx - 0.5, Math.min(goal.gx + 0.5, x)),
      y: Math.max(goal.gy - 0.5, Math.min(goal.gy + 0.5, y)),
      z: 0,
    };
  }

  /**
   * Waypoints from `from` toward (x, y), ending at resolveDestination's spot. Routes
   * around furniture with A* and string-pulls the result.
   */
  function planPath(from: Position, x: number, y: number): Position[] {
    const destination = resolveDestination(from, x, y);
    const startPoint = { gx: from.x, gy: from.y };
    const endPoint = { gx: destination.x, gy: destination.y };
    if (isLineClear(startPoint, endPoint, isWalkable)) return [destination];

    const cells = findPath(cellOf(from.x, from.y), cellOf(destination.x, destination.y), isWalkable);
    if (cells.length === 0) return [destination];
    // Smooth toward the exact destination, not its cell centre, so the last leg is checked too.
    cells[cells.length - 1] = endPoint;
    const turns = smoothPath(startPoint, cells, isWalkable).slice(0, -1);
    return [...turns.map(c => ({ x: c.gx, y: c.gy, z: 0 })), destination];
  }

  /** Point an actor at a new floor position, routing around furniture. Leaves any seat. */
  function setActorDestination(uid: string, x: number, y: number) {
    delete pendingSitRef.current[uid];
    delete pendingEmoteRef.current[uid];
    clearMutual(uid);
    const walkId = (walkSeqRef.current[uid] ?? 0) + 1;
    walkSeqRef.current[uid] = walkId;
    setActors(current => {
      const actor = current[uid];
      if (!actor) return current;
      // Standing up steps forward off the seat first, so nobody walks back through the furniture.
      const seat = actor.action.kind === 'sit' ? findSeat(roomDetails?.items ?? [], actor.action) : null;
      const spot = seat && standingSpot(seat.item, seat.seat);
      const path = spot
        ? [{ x: spot.gx, y: spot.gy, z: 0 }, ...planPath({ x: spot.gx, y: spot.gy, z: 0 }, x, y)]
        : planPath(actor.position, x, y);
      const walk: ActorAction = { kind: 'walk', path };
      walkIds.set(walk, walkId);
      return {
        ...current,
        [uid]: {
          ...actor,
          position: path[path.length - 1],
          // Engines that animate per segment re-derive facing from travel; this is the first leg's.
          facing: facingFromDelta(path[0].x - actor.position.x, path[0].y - actor.position.y),
          action: walk,
        },
      };
    });
  }

  function walkMeTo(destGx: number, destGy: number) {
    const me = actors[userId];
    if (!me) return;
    // Send where the walk really ends, so the room and the server's presence agree on it.
    const { x, y } = resolveDestination(me.position, destGx, destGy);
    moveMe(x, y);
    setActorDestination(userId, x, y);
  }

  /**
   * Walk an actor to the floor in front of a seat. The walk's completion seats it (see
   * onActionComplete). Ignored when the item or seat is no longer in the room.
   */
  function walkToSeat(uid: string, action: SitAction) {
    const found = findSeat(roomDetails?.items ?? [], action);
    if (!found) return;
    const spot = standingSpot(found.item, found.seat);
    setActorDestination(uid, spot.gx, spot.gy);
    pendingSitRef.current[uid] = action;
  }

  /** The cell in front of a seat, else any free cell beside it, else the seat's own cell. */
  function standingSpot(item: RoomItem, seat: ItemSeat): GridPoint {
    const front = seatApproach(item, seat);
    if (isWalkable(front.gx, front.gy)) return front;
    const gx = item.position.x + seat.cell.x;
    const gy = item.position.y + seat.cell.y;
    const beside = [
      { gx: gx - 1, gy },
      { gx: gx + 1, gy },
      { gx, gy: gy - 1 },
      { gx, gy: gy + 1 },
    ].find(c => isWalkable(c.gx, c.gy));
    return beside ?? { gx, gy };
  }

  /** A seat someone is sitting on or walking to. */
  function seatOf(actor: ActorState): SitAction | null {
    return pendingSitRef.current[actor.id] ?? (actor.action.kind === 'sit' ? actor.action : null);
  }

  /** The free seat on an item nearest the actor. Null when all are taken or it already sits there. */
  function pickSeat(roomItem: RoomItem, me: ActorState): SitAction | null {
    const mine = seatOf(me);
    const at = { x: roomItem.position.x, y: roomItem.position.y };
    if (mine && mine.itemId === roomItem.itemId._id && mine.at.x === at.x && mine.at.y === at.y) return null;

    const taken = Object.values(actors).flatMap(a => {
      const seat = a.id === me.id ? null : seatOf(a);
      return seat ? [seat] : [];
    });
    let best: SitAction | null = null;
    let bestDistance = Infinity;
    itemSeats(roomItem).forEach((seat, seatIndex) => {
      const action: SitAction = { kind: 'sit', itemId: roomItem.itemId._id, at, seatIndex };
      if (taken.some(t => sameSeat(t, action))) return;
      const p = seatPosition(roomItem, seat);
      const distance = Math.hypot(p.x - me.position.x, p.y - me.position.y);
      if (distance < bestDistance) {
        best = action;
        bestDistance = distance;
      }
    });
    return best;
  }

  /**
   * Play an emote on an actor: now when it stands still, after its walk when walking (a
   * seated user stands up first, which arrives as a walk). Seated actors don't emote.
   * Skipped when the engine has no emotes. Ends any mutual emote the actor was heading to.
   * Decided on the latest state, since standing up may have been queued just before.
   */
  function playEmote(uid: string, action: EmoteAction) {
    if (!canEmote || pendingSitRef.current[uid]) return;
    clearMutual(uid);
    setActors(current => {
      const a = current[uid];
      if (!a || a.action.kind === 'sit') return current;
      if (a.action.kind === 'walk') {
        pendingEmoteRef.current[uid] = action;
        return current;
      }
      return { ...current, [uid]: startEmote(current, a, action) };
    });
  }

  /** The actor with the emote playing, turned to whoever it is aimed at (a throw's target). */
  function startEmote(current: Record<string, ActorState>, actor: ActorState, action: EmoteAction): ActorState {
    const target = current[faceTargetOf.get(action) ?? ''];
    const facing = target && target.id !== actor.id
      ? facingFromDelta(target.position.x - actor.position.x, target.position.y - actor.position.y)
      : actor.facing;
    return { ...actor, facing, action };
  }

  /**
   * If the local user is seated (or heading to a seat), stand up: walk to the floor in front
   * of the seat and tell the room. Returns that spot, or null when not seated.
   */
  function standUpMe(): { x: number; y: number } | null {
    const me = actors[userId];
    const seat = me && seatOf(me);
    const found = seat && findSeat(roomDetails?.items ?? [], seat);
    if (!found) return null;
    const spot = standingSpot(found.item, found.seat);
    walkMeTo(spot.gx, spot.gy);
    return { x: spot.gx, y: spot.gy };
  }

  function onActionComplete(actorId: string, action: ActorActionKind, finished?: ActorAction) {
    if (action === 'emote') {
      setActors(current => {
        const actor = current[actorId];
        if (!actor || actor.action.kind !== 'emote') return current;
        return { ...current, [actorId]: { ...actor, action: { kind: 'idle' } } };
      });
      return;
    }
    if (action !== 'walk') return;
    // A walk can finish on the UI thread just as a tap starts a new one. Its report then
    // arrives after the new walk began; acting on it would end the new walk at once and
    // snap the actor to its destination.
    if (finished && walkIds.get(finished) !== walkSeqRef.current[actorId]) return;
    // Arrived at a mutual emote spot: face the partner, and start if they are there too.
    const part = mutualRef.current[actorId];
    if (part) {
      part.arrived = true;
      setActors(current => {
        const actor = current[actorId];
        if (!actor || actor.action.kind !== 'walk') return current;
        return { ...current, [actorId]: { ...actor, facing: part.facing, action: { kind: 'idle' } } };
      });
      tryStartMutual(part.requestId);
      return;
    }
    const sit = pendingSitRef.current[actorId];
    const emote = pendingEmoteRef.current[actorId];
    delete pendingSitRef.current[actorId];
    delete pendingEmoteRef.current[actorId];
    const found = sit ? findSeat(roomDetails?.items ?? [], sit) : null;
    setActors(current => {
      const actor = current[actorId];
      if (!actor || actor.action.kind !== 'walk') return current;
      let next: ActorState;
      if (sit && found) next = { ...actor, position: seatPosition(found.item, found.seat), facing: found.seat.facing, action: sit };
      else if (emote) next = startEmote(current, actor, emote);
      else next = { ...actor, action: { kind: 'idle' } };
      return { ...current, [actorId]: next };
    });
  }

  // ── Joystick steering (experimental, see joystick/) ──────────────────────
  // The engine moves the local actor while the stick is pushed. Here it walks (for the walk
  // clip), its position is sent ahead of where it is drawn, and it stops where the engine says.

  const steeringRef = useRef(false);

  function steerStart() {
    if (isEditMode || !actors[userId]) return;
    steeringRef.current = true;
    delete pendingSitRef.current[userId];
    delete pendingEmoteRef.current[userId];
    clearMutual(userId);
    // A walk the stick cut short may still report finishing; that report is now ignored.
    walkSeqRef.current[userId] = (walkSeqRef.current[userId] ?? 0) + 1;
    setActors(current => {
      const me = current[userId];
      // An empty walk: the engine draws walking, and moves the actor itself.
      return me ? { ...current, [userId]: { ...me, action: { kind: 'walk', path: [] } } } : current;
    });
  }

  function steerMove(_at: FloorPoint, ahead: FloorPoint) {
    if (!steeringRef.current) return;
    // Others walk toward a point a little ahead, so they see one smooth walk, not hops.
    // The server stands us up from any seat and ends any emote on the first one.
    moveMe(ahead.x, ahead.y);
  }

  function steerStop(at: FloorPoint) {
    if (!steeringRef.current) return;
    steeringRef.current = false;
    moveMe(at.x, at.y);
    const emote = pendingEmoteRef.current[userId];
    delete pendingEmoteRef.current[userId];
    setActors(current => {
      const me = current[userId];
      if (!me) return current;
      const stopped: ActorState = { ...me, position: { x: at.x, y: at.y, z: 0 }, action: { kind: 'idle' } };
      // An emote chosen while steering plays now, as one chosen mid-walk does on arrival.
      return { ...current, [userId]: emote ? startEmote(current, stopped, emote) : stopped };
    });
  }

  // ── Play-mode intents ─────────────────────────────────────────────────────

  function walkTo({ gx, gy }: GridPoint) {
    // The stick is in charge while it is pushed.
    if (isEditMode || steeringRef.current) return;
    // Clamp to the floor, whose cells are centred on grid vertices: it spans -0.5 to size - 0.5.
    const destGx = Math.max(-0.5, Math.min(roomDimensions.x - 0.5, gx));
    const destGy = Math.max(-0.5, Math.min(roomDimensions.y - 0.5, gy));
    walkMeTo(destGx, destGy);
  }

  /**
   * When an item with an action is tapped: sit on its nearest free seat if it has seats,
   * otherwise walk to the nearest adjacent walkable cell.
   */
  function interactWith(roomItem: RoomItem) {
    if (isEditMode || steeringRef.current) return;
    const me = actors[userId];
    if (!me) return;

    if (roomItem.itemId.action === ItemAction.SIT && roomItem.itemId.seats?.length) {
      const seat = pickSeat(roomItem, me);
      if (!seat) return;
      // Others walk the actor to the seat themselves, so no point is sent.
      sendAction(seat);
      walkToSeat(userId, seat);
      return;
    }

    const { x: ix, y: iy } = roomItem.position;
    // Try the 4 adjacent cells and pick the closest walkable one
    const candidates = [
      { gx: ix - 1, gy: iy },
      { gx: ix + 1, gy: iy },
      { gx: ix, gy: iy - 1 },
      { gx: ix, gy: iy + 1 },
    ].filter(c => isWalkable(c.gx, c.gy));

    if (!candidates.length) return;

    const from = { gx: me.position.x, gy: me.position.y };
    const best = candidates.reduce((closest, c) => {
      const dCurrent = Math.abs(c.gx - from.gx) + Math.abs(c.gy - from.gy);
      const dBest = Math.abs(closest.gx - from.gx) + Math.abs(closest.gy - from.gy);
      return dCurrent < dBest ? c : closest;
    });

    walkMeTo(best.gx, best.gy);
  }

  /**
   * One of the user's emotes was chosen. A solo one plays for everyone at once (standing up
   * first if seated). A mutual or interactive one waits for a tap on whom it is for.
   */
  function emote(animation: string, type: EmoteType = EmoteType.SOLO) {
    if (isEditMode || !actors[userId]) return;
    if (type === EmoteType.MUTUAL || type === EmoteType.INTERACTIVE) {
      setPicking({ animation, type });
      return;
    }
    setPicking(null);
    // Standing up goes out as a point first, so others see the stand, then the emote.
    standUpMe();
    const action: EmoteAction = { kind: 'emote', animation };
    sendAction(action);
    playEmote(userId, action);
  }

  /**
   * An avatar was tapped. While picking someone for an emote, it is them: a mutual emote
   * asks them (they answer on their device), an interactive one is thrown at them at once,
   * and picking stays on so more can follow. Otherwise the tap isn't ours to use.
   */
  function tapActor(actorId: string): boolean {
    if (!picking || isEditMode || actorId === userId || !actors[actorId]) return false;
    const { animation, type } = picking;
    if (type === EmoteType.MUTUAL) {
      setPicking(null);
      sendEmoteRequest(animation, actorId);
      return true;
    }
    standUpMe();
    sendInteraction(animation, actorId);
    throwAt(userId, actorId, animation);
    return true;
  }

  function cancelPicking() {
    setPicking(null);
  }

  /** Withdraw our pending mutual emote request. */
  function cancelEmoteRequest() {
    if (!outgoing) return;
    sendEmoteRequestCancel(outgoing.requestId);
    setOutgoing(null);
  }

  /**
   * Answer a mutual emote request. Accepting while seated stands up first; the server puts
   * us at the spot we stand (or are walking) to and brings the asker over.
   */
  function answerEmoteRequest(requestId: string, accept: boolean) {
    const request = incoming.find(r => r.requestId === requestId);
    const me = actors[userId];
    setIncoming(list => list.filter(r => r.requestId !== requestId));
    if (!request || !me) return;
    if (!accept) {
      respondToEmoteRequest(requestId, false);
      return;
    }
    const at = standUpMe() ?? { x: me.position.x, y: me.position.y };
    acceptedRef.current = request;
    respondToEmoteRequest(requestId, true, at);
  }

  function submitMessage(message: string) {
    sendMessage(message);
    stopTyping(userId);
    pushChatMessage(userId, message);
  }

  /**
   * The user typed. Their own bubble shows at once; the room hears at most once per
   * TYPING_SEND_MS, which keeps others' bubbles up (they clear after TYPING_SHOW_MS).
   */
  function typing() {
    markTyping(userId);
    if (typingSentRef.current) return;
    typingSentRef.current = true;
    sendTyping();
    setTimeout(() => { typingSentRef.current = false; }, TYPING_SEND_MS);
  }

  // ── Edit-mode intents ─────────────────────────────────────────────────────

  function enterEdit() {
    setPicking(null);
    setPendingItems(roomDetails?.items ? [...roomDetails.items] : []);
    setPendingTheme(roomDetails?.theme ?? null);
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setMode('edit');
  }

  function cancelEdit() {
    setMode('play');
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setPendingItems([]);
    setPendingTheme(null);
  }

  async function saveEdit() {
    setIsSaving(true);
    try {
      const body = pendingItems.map(ri => ({
        itemId: ri.itemId._id,
        position: ri.position,
        orientation: ri.orientation,
        state: ri.state,
      }));
      const theme = pendingTheme && {
        floor: pendingTheme.floor?._id ?? null,
        leftWall: pendingTheme.leftWall?._id ?? null,
        rightWall: pendingTheme.rightWall?._id ?? null,
      };
      await api.patch(`/api/v1/rooms/${roomId}/items`, { items: body, theme });
      // Play mode draws the room's saved items, so load the new layout before leaving edit
      // mode; otherwise the old items show until the room is entered again.
      await queryClient.invalidateQueries({ queryKey: ['roomDetails', roomId] });
      setMode('play');
      setSelectedItem(null);
      setSelectedPlacedItem(null);
    } catch (e) {
      console.error('Failed to save room layout', e);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Choose an inventory item to place. A wallpaper or flooring isn't placed: choosing it
   * puts it straight on both walls or the floor (the server also takes one wall at a time).
   */
  function selectInventoryItem(item: Item | null) {
    setSelectedPlacedItem(null);
    const slots = item ? themeSlotsOf(item) : [];
    if (item && slots.length) {
      setSelectedItem(null);
      setPendingTheme(current => {
        if (!current) return current;
        const next = { ...current };
        for (const slot of slots) next[slot] = item;
        return next;
      });
      return;
    }
    setSelectedItem(item);
  }

  /**
   * Turn the picked-up item between its two drawn facings (see isMirrored). It stays
   * picked up. Ignored for wall items, which would flip onto the other wall, and when the
   * turned footprint wouldn't fit.
   */
  function rotateSelectedPlaced() {
    if (selectedPlacedItem?.itemId.placement !== ItemPlacement.FLOOR) return;
    const orientation = isMirrored(selectedPlacedItem.orientation) ? Orientiation.ZERO : Orientiation.NINETY;
    const turned: RoomItem = { ...selectedPlacedItem, orientation };
    if (!fitsAt(pendingItems, turned, roomDimensions, selectedPlacedItem)) return;
    setPendingItems(current => current.map(ri => (ri === selectedPlacedItem ? turned : ri)));
    setSelectedPlacedItem(turned);
  }

  function removeSelectedPlaced() {
    if (!selectedPlacedItem) return;
    setPendingItems(current => current.filter(ri => ri !== selectedPlacedItem));
    setSelectedPlacedItem(null);
  }

  /**
   * `hit` is the item whose art was tapped; `onFloor` the one standing on the tapped
   * cell. Nothing is ever replaced: a tap on taken floor picks that item up instead.
   */
  function editCell({ gx, gy }: GridPoint, hit: RoomItem | null) {
    const onFloor = itemCovering(pendingItems, gx, gy);

    // A placed item is picked up: move it to the tapped cell
    if (selectedPlacedItem) {
      const { x, y } = selectedPlacedItem.position;
      // Tap it again (its art or its own cell) → put it down where it was
      if (hit === selectedPlacedItem || (x === gx && y === gy)) {
        setSelectedPlacedItem(null);
        return;
      }
      const moved: RoomItem = { ...selectedPlacedItem, position: { x: gx, y: gy, z: 0 } };
      if (fitsAt(pendingItems, moved, roomDimensions, selectedPlacedItem)) {
        setPendingItems(current => [...current.filter(ri => ri !== selectedPlacedItem), moved]);
        setSelectedPlacedItem(null);
      } else if (onFloor && onFloor !== selectedPlacedItem) {
        setSelectedPlacedItem(onFloor);
      }
      return;
    }

    // An inventory item is selected: place a copy, as many as are owned
    if (selectedItem) {
      const ownedCount = inventoryItems.filter(i => i._id === selectedItem._id).length;
      const placedCount = pendingItems.filter(ri => ri.itemId._id === selectedItem._id).length;
      const newItem: RoomItem = {
        itemId: selectedItem,
        position: { x: gx, y: gy, z: 0 },
        orientation: Orientiation.ZERO,
        state: ItemState.NONE,
      };
      if (fitsAt(pendingItems, newItem, roomDimensions)) {
        if (placedCount < ownedCount) setPendingItems(current => [...current, newItem]);
      } else if (onFloor) {
        setSelectedItem(null);
        setSelectedPlacedItem(onFloor);
      }
      return;
    }

    // Nothing selected: pick up the tapped item
    const target = hit ?? onFloor;
    if (target) setSelectedPlacedItem(target);
  }

  // ── Derived state for engines ─────────────────────────────────────────────

  const scene: RoomScene | null = roomDetails
    ? {
      dimensions: roomDimensions,
      theme: (isEditMode && pendingTheme) || roomDetails.theme,
      items: isEditMode ? pendingItems : (roomDetails.items ?? []),
      doors: roomDetails.doors ?? [],
    }
    : null;

  const renderedActors = useMemo(() => {
    const result: Record<string, ActorState> = {};
    for (const actor of Object.values(actors)) {
      result[actor.id] = {
        ...actor,
        avatar: (actor.id === userId ? selectedAvatar : avatars[actor.id]) ?? undefined,
        isTyping: typingUserIds.has(actor.id),
      };
    }
    return result;
  }, [actors, avatars, userId, selectedAvatar, typingUserIds]);

  const edit: EditState = { selectedItem, selectedPlaced: selectedPlacedItem };

  return {
    roomDetails,
    isLoading,
    error,
    isOwner,
    isSaving,
    mode,
    scene,
    actors: renderedActors,
    localActorId: userId,
    edit,
    typingUserIds,
    /** Chat messages since entering, oldest first, capped at TRANSCRIPT_MAX. */
    transcript,
    /** Names of the others typing, for the line above the chat input. */
    typingNames: [...typingUserIds].filter(id => id !== userId).map(id => typingNames[id] ?? 'Someone'),
    onActionComplete,
    /** Whether this device's engine plays emotes; the shell hides the emote button otherwise. */
    canEmote,
    /** Thrown props for the engine to draw. */
    effects,
    /** An emote waiting for the user to tap whom it is for. */
    picking,
    /** Our mutual emote request, until it is answered. */
    outgoingRequest: outgoing,
    /** The oldest mutual emote request to us still waiting for an answer. */
    incomingRequest: incoming[0] ?? null,
    /** What became of a request that ended without starting, for a few seconds. */
    emoteNotice,
    /** No one else is in the room. False until the server's presence snapshot has arrived. */
    isAlone: presenceKnown && Object.keys(actors).every(id => id === userId),
    /** The signed-in user. */
    userId,
    intents: {
      walkTo,
      interactWith,
      emote,
      tapActor,
      cancelPicking,
      cancelEmoteRequest,
      answerEmoteRequest,
      submitMessage,
      typing,
      enterEdit,
      cancelEdit,
      saveEdit,
      selectInventoryItem,
      rotateSelectedPlaced,
      removeSelectedPlaced,
      editCell,
      steerStart,
      steerMove,
      steerStop,
    },
  };
}

export type RoomSession = ReturnType<typeof useRoomSession>;
