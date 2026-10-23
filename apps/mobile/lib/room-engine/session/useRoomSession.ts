import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth.context';
import { useUserInfo } from '@/context/user.context';
import { useChat } from '@/hooks/useChat';
import { useInventory } from '@/hooks/useInventory';
import { api } from '@/lib/api';
import type { GridPoint } from '@/constants/grid';
import {
  Facing,
  ItemAction,
  ItemState,
  Orientiation,
  type ActorAction,
  type ActorActionKind,
  type Avatar,
  type Item,
  type ItemSeat,
  type Position,
  type RoomItem,
  type RoomOccupant,
  type RoomPresenceState,
  type User,
} from '@chat-app/shared-types';
import type { ActorState, EditState, EngineCapabilities, RoomMode, RoomScene } from '../core/contract';
import { fitsAt, itemCovering } from '../core/editLayout';
import { facingFromDelta } from '../core/facing';
import { findSeat, sameSeat, seatApproach, seatPosition, type SitAction } from '../core/seats';
import { findPath, isLineClear, smoothPath } from '../core/usePathfinding';
import { useWalkabilityGrid } from '../core/useWalkabilityGrid';
import { useRoomDetails } from '../hooks/useRoomDetails';

type EmoteAction = Extract<ActorAction, { kind: 'emote' }>;

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
  const canEmote = capabilities.actions.includes('emote');

  const { user } = useUserInfo();
  const { selectedAvatar } = useAuth();
  const userId = user?.userId ?? '';

  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const bubbleIdRef = useRef(0);

  // Edit mode
  const [mode, setMode] = useState<RoomMode>('play');
  const isEditMode = mode === 'edit';
  const [pendingItems, setPendingItems] = useState<RoomItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<RoomItem | null>(null);
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

  const { moveMe, sendMessage, sendTyping, sendAction } = useChat({
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
  }

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
    pushChatMessage(userId, message);
  }

  function receiveTyping({ userId }: { userId: string }) {
    enterCharacter(userId);
    setTypingUserIds(prev => new Set(prev).add(userId));
    clearTimeout(typingTimeoutRef.current[userId]);
    typingTimeoutRef.current[userId] = setTimeout(() => {
      setTypingUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }, 2000);
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
    setActors(current => ({ ...current, [uid]: actor }));
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
    setActors(current => {
      const { [uid]: _, ...rest } = current;
      return rest;
    });
  }

  /** `elapsedMs` is how long ago it was sent, for a message seen late. */
  function pushChatMessage(uid: string, message: string, elapsedMs = 0) {
    const bubble = { id: `${bubbleIdRef.current++}`, text: message, sentAt: Date.now() - elapsedMs };
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
   * Waypoints from `from` to (x, y), ending exactly at (x, y). Routes around furniture
   * with A* and string-pulls the result. Falls back to a straight line when the target
   * cell is blocked or unreachable, as movement worked before pathfinding.
   */
  function planPath(from: Position, x: number, y: number): Position[] {
    const destination = { x, y, z: 0 };
    const start = cellOf(from.x, from.y);
    const goal = cellOf(x, y);
    if (isLineClear(start, goal, isWalkable)) return [destination];

    const cells = findPath(start, goal, isWalkable);
    if (cells.length === 0) return [destination];
    const turns = smoothPath(start, cells, isWalkable).slice(0, -1);
    return [...turns.map(c => ({ x: c.gx, y: c.gy, z: 0 })), destination];
  }

  /** Point an actor at a new floor position, routing around furniture. Leaves any seat. */
  function setActorDestination(uid: string, x: number, y: number) {
    delete pendingSitRef.current[uid];
    delete pendingEmoteRef.current[uid];
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
    if (!actors[userId]) return;
    moveMe(destGx, destGy);
    setActorDestination(userId, destGx, destGy);
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
    (roomItem.itemId.seats ?? []).forEach((seat, seatIndex) => {
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
   * Play an emote on an actor: now when it stands still, after its walk when walking.
   * Seated actors don't emote. Skipped when the engine has no emotes.
   */
  function playEmote(uid: string, action: EmoteAction) {
    if (!canEmote) return;
    const actor = actors[uid];
    if (actor?.action.kind === 'sit' || pendingSitRef.current[uid]) return;
    if (actor?.action.kind === 'walk') {
      pendingEmoteRef.current[uid] = action;
      return;
    }
    setActors(current => {
      const a = current[uid];
      if (!a || a.action.kind === 'walk' || a.action.kind === 'sit') return current;
      return { ...current, [uid]: { ...a, action } };
    });
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
    const sit = pendingSitRef.current[actorId];
    const emote = pendingEmoteRef.current[actorId];
    delete pendingSitRef.current[actorId];
    delete pendingEmoteRef.current[actorId];
    const found = sit ? findSeat(roomDetails?.items ?? [], sit) : null;
    setActors(current => {
      const actor = current[actorId];
      if (!actor || actor.action.kind !== 'walk') return current;
      const next: ActorState = sit && found
        ? { ...actor, position: seatPosition(found.item, found.seat), facing: found.seat.facing, action: sit }
        : { ...actor, action: emote ?? { kind: 'idle' } };
      return { ...current, [actorId]: next };
    });
  }

  // ── Play-mode intents ─────────────────────────────────────────────────────

  function walkTo({ gx, gy }: GridPoint) {
    if (isEditMode) return;
    // Clamp to floor bounds — characters use float positions, not cell centres
    const destGx = Math.max(0, Math.min(roomDimensions.x, gx));
    const destGy = Math.max(0, Math.min(roomDimensions.y, gy));
    walkMeTo(destGx, destGy);
  }

  /**
   * When an item with an action is tapped: sit on its nearest free seat if it has seats,
   * otherwise walk to the nearest adjacent walkable cell.
   */
  function interactWith(roomItem: RoomItem) {
    if (isEditMode) return;
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

  /** Play one of the user's emotes for everyone in the room. Not while seated or heading to a seat. */
  function emote(animation: string) {
    if (isEditMode) return;
    const me = actors[userId];
    if (!me || seatOf(me)) return;
    const action: EmoteAction = { kind: 'emote', animation };
    sendAction(action);
    playEmote(userId, action);
  }

  function submitMessage(message: string) {
    sendMessage(message);
    pushChatMessage(userId, message);
  }

  // ── Edit-mode intents ─────────────────────────────────────────────────────

  function enterEdit() {
    setPendingItems(roomDetails?.items ? [...roomDetails.items] : []);
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setMode('edit');
  }

  function cancelEdit() {
    setMode('play');
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setPendingItems([]);
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
      await api.patch(`/api/v1/rooms/${roomId}/items`, { items: body });
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

  function selectInventoryItem(item: Item | null) {
    setSelectedItem(item);
    setSelectedPlacedItem(null);
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
      theme: roomDetails.theme,
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
    onActionComplete,
    /** Whether this device's engine plays emotes; the shell hides the emote button otherwise. */
    canEmote,
    /** The local user is seated, so emotes are unavailable. */
    isSeated: actors[userId]?.action.kind === 'sit',
    intents: {
      walkTo,
      interactWith,
      emote,
      submitMessage,
      sendTyping,
      enterEdit,
      cancelEdit,
      saveEdit,
      selectInventoryItem,
      removeSelectedPlaced,
      editCell,
    },
  };
}

export type RoomSession = ReturnType<typeof useRoomSession>;
