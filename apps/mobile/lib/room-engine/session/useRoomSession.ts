import { useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/auth.context';
import { useUserInfo } from '@/context/user.context';
import { useChat } from '@/hooks/useChat';
import { useInventory } from '@/hooks/useInventory';
import { api } from '@/lib/api';
import type { GridPoint } from '@/constants/grid';
import {
  Facing,
  ItemState,
  Orientiation,
  type ActorActionKind,
  type Item,
  type RoomItem,
  type User,
} from '@chat-app/shared-types';
import type { ActorState, EditState, RoomMode, RoomScene } from '../core/contract';
import { facingFromDelta } from '../core/facing';
import { useWalkabilityGrid } from '../core/useWalkabilityGrid';
import { useRoomDetails } from '../hooks/useRoomDetails';

/**
 * Engine-agnostic room state: socket events, characters, chat and edit mode.
 * Engines render what this returns and report user intents back through `intents`.
 */
export function useRoomSession(roomId: string) {
  const { data: roomDetails, isLoading, error } = useRoomDetails(roomId);
  const { data: inventoryItems = [] } = useInventory();
  const [actors, setActors] = useState<Record<User['_id'], ActorState>>({});

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

  const { moveMe, sendMessage, sendTyping } = useChat({
    roomId,
    userId,
    handlers: {
      onEnter: receiveEnter,
      onExit: receiveExit,
      onPoint: receivePoint,
      onMessage: receiveMessage,
      onTyping: receiveTyping,
    },
    getMyPosition: () => {
      const actor = actors[userId ?? ''];
      return actor ? { x: actor.position.x, y: actor.position.y } : { x: 0, y: 0 };
    },
    onEnterMe: () => enterCharacter(userId ?? ''),
  });

  function receiveEnter({ userId }: { userId: string }) {
    enterCharacter(userId);
  }

  function receiveExit({ userId }: { userId: string }) {
    exitCharacter(userId);
  }

  function receivePoint({ userId, x, y }: { userId: string; x: number; y: number }) {
    enterCharacter(userId);
    setActorDestination(userId, x, y);
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

  function enterCharacter(uid: string) {
    if (actors[uid]) return;
    const spawnDoor = roomDetails?.doors?.find(d => d.isEntry);
    const spawnPos = spawnDoor
      ? { x: spawnDoor.position.x, y: spawnDoor.position.y, z: 0 }
      : { x: 0, y: 0, z: 0 };

    setActors(current => ({
      ...current,
      [uid]: {
        id: uid,
        user: { _id: uid } as User,
        position: spawnPos,
        facing: Facing.SE,
        action: { kind: 'idle' },
        bubbles: [],
        isTyping: false,
      },
    }));
  }

  function exitCharacter(uid: string) {
    setActors(current => {
      const { [uid]: _, ...rest } = current;
      return rest;
    });
  }

  function pushChatMessage(uid: string, message: string) {
    const bubble = { id: `${bubbleIdRef.current++}`, text: message };
    setActors(current => {
      const actor = current[uid];
      if (!actor) return current;
      return { ...current, [uid]: { ...actor, bubbles: [...actor.bubbles, bubble] } };
    });
  }

  /** Point an actor at a new floor position (no grid snapping, no pathfinding yet). */
  function setActorDestination(uid: string, x: number, y: number) {
    setActors(current => {
      const actor = current[uid];
      if (!actor) return current;
      const destination = { x, y, z: 0 };
      return {
        ...current,
        [uid]: {
          ...actor,
          position: destination,
          facing: facingFromDelta(x - actor.position.x, y - actor.position.y),
          action: { kind: 'walk', path: [destination] },
        },
      };
    });
  }

  function walkMeTo(destGx: number, destGy: number) {
    if (!actors[userId]) return;
    moveMe(destGx, destGy);
    setActorDestination(userId, destGx, destGy);
  }

  function onActionComplete(actorId: string, action: ActorActionKind) {
    setActors(current => {
      const actor = current[actorId];
      if (!actor || actor.action.kind !== action || action !== 'walk') return current;
      return { ...current, [actorId]: { ...actor, action: { kind: 'idle' } } };
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
   * When an item with an action is tapped: walk to the nearest adjacent walkable cell.
   */
  function interactWith(roomItem: RoomItem) {
    if (isEditMode) return;
    const me = actors[userId];
    if (!me) return;

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

  function editCell({ gx, gy }: GridPoint) {
    // A placed item is "picked up" — move it to the tapped cell
    if (selectedPlacedItem) {
      // Tap the same cell → deselect without moving
      if (selectedPlacedItem.position.x === gx && selectedPlacedItem.position.y === gy) {
        setSelectedPlacedItem(null);
        return;
      }
      const moved: RoomItem = { ...selectedPlacedItem, position: { x: gx, y: gy, z: 0 } };
      setPendingItems(current => {
        const filtered = current.filter(
          ri => ri !== selectedPlacedItem && !(ri.position.x === gx && ri.position.y === gy),
        );
        return [...filtered, moved];
      });
      setSelectedPlacedItem(null);
      return;
    }

    // An inventory item is selected — place it
    if (selectedItem) {
      // Enforce placement limit: can only place as many copies as owned
      const ownedCount = inventoryItems.filter(i => i._id === selectedItem._id).length;
      const alreadyPlacedCount = pendingItems.filter(
        ri => ri.itemId._id === selectedItem._id,
      ).length;
      // If placing on a cell already occupied by THIS item, it's a move not a new placement
      const isReplace = pendingItems.some(
        ri => ri.position.x === gx && ri.position.y === gy && ri.itemId._id === selectedItem._id,
      );
      if (!isReplace && alreadyPlacedCount >= ownedCount) return;

      const newItem: RoomItem = {
        itemId: selectedItem,
        position: { x: gx, y: gy, z: 0 },
        orientation: Orientiation.ZERO,
        state: ItemState.NONE,
      };
      setPendingItems(current => {
        const filtered = current.filter(
          ri => !(ri.position.x === gx && ri.position.y === gy),
        );
        return [...filtered, newItem];
      });
      return;
    }

    // Nothing selected — tap an occupied cell to select that placed item
    const itemAtCell = pendingItems.find(ri => ri.position.x === gx && ri.position.y === gy);
    if (itemAtCell) {
      setSelectedPlacedItem(itemAtCell);
    }
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
        avatar: actor.id === userId && selectedAvatar ? selectedAvatar : undefined,
        isTyping: typingUserIds.has(actor.id),
      };
    }
    return result;
  }, [actors, userId, selectedAvatar, typingUserIds]);

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
    intents: {
      walkTo,
      interactWith,
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
