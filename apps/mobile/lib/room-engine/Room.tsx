import { ReactNativeZoomableView, type ZoomableViewEvent } from '@openspacelabs/react-native-zoomable-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, type GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth.context';
import { useUserInfo } from '@/context/user.context';
import { useChat } from '@/hooks/useChat';
import { useInventory } from '@/hooks/useInventory';
import { computeOrigin, screenToGrid } from '@/constants/grid';
import { CharacterDirection, Orientiation, ItemState, type Item, type RoomCharacter, type RoomItem, type User } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
import { api } from '@/lib/api';
import { RoomBackdrop } from './components/RoomBackdrop';
import { TypingIndicator } from './components/TypingIndicator';
import { useRoomDetails } from './hooks/useRoomDetails';
import Character from './components/Character';
import { ChatInput } from './components/ChatInput';
import { useWalkabilityGrid } from './hooks/useWalkabilityGrid';
import { RoomItemView } from './components/RoomItemView';
import { EditModeButton } from './EditMode/EditModeButton';
import { EditModeToolbar } from './EditMode/EditModeToolbar';
import { GridOverlay } from './EditMode/GridOverlay';
import { InventoryDrawer } from './EditMode/InventoryDrawer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
  },
  backBtn: {
    padding: 8,
  },
  roomHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
});

export function Room({ roomId }: Readonly<{ roomId: string }>) {

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: roomDetails, isLoading: isRoomLoading, error: roomError } = useRoomDetails(roomId);
  const { data: inventoryItems = [] } = useInventory();
  const [roomCharacters, setRoomCharacters] = useState<Record<User['_id'], RoomCharacter>>({});

  const { user } = useUserInfo();
  const { selectedAvatar } = useAuth();
  const userId = user?.userId ?? '';

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<View>(null);
  const canvasPageOffset = useRef({ x: 0, y: 0 });
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
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
  const origin = canvasSize.width > 0
    ? computeOrigin(canvasSize.width, roomDimensions)
    : { x: 0, y: 0 };

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
      const character = roomCharacters[userId ?? ''];
      return character ? { x: character.position.x, y: character.position.y } : { x: 0, y: 0 };
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
    setRoomCharacters(current => {
      const character = current[userId];
      if (!character) return current;
      const direction = x < character.position.x ? CharacterDirection.LEFT : CharacterDirection.RIGHT;
      return { ...current, [userId]: { ...character, position: { x, y, z: 0 }, direction } };
    });
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
    if (roomCharacters[uid]) return;
    const spawnDoor = roomDetails?.doors?.find(d => d.isEntry);
    const spawnPos = spawnDoor
      ? { x: spawnDoor.position.x, y: spawnDoor.position.y, z: 0 }
      : { x: 0, y: 0, z: 0 };

    setRoomCharacters(current => ({
      ...current,
      [uid]: {
        user: { _id: uid } as User,
        position: spawnPos,
        direction: CharacterDirection.RIGHT,
        messages: [],
        isTyping: false,
      },
    }));
  }

  function exitCharacter(uid: string) {
    setRoomCharacters(current => {
      const { [uid]: _, ...rest } = current;
      return rest;
    });
  }

  function pushChatMessage(uid: string, message: string) {
    setRoomCharacters(current => {
      const character = current[uid];
      if (!character) return current;
      return { ...current, [uid]: { ...character, messages: [...character.messages, message] } };
    });
  }

  /** Walk the local user directly to any floor position (no grid snapping, no pathfinding). */
  function walkMeTo(destGx: number, destGy: number) {
    const me = roomCharacters[userId];
    if (!me) return;
    const direction = destGx < me.position.x ? CharacterDirection.LEFT : CharacterDirection.RIGHT;
    moveMe(destGx, destGy);
    setRoomCharacters(current => {
      const character = current[userId];
      if (!character) return current;
      return {
        ...current,
        [userId]: { ...character, position: { x: destGx, y: destGy, z: 0 }, direction },
      };
    });
  }

  function enterEditMode() {
    setPendingItems(roomDetails?.items ? [...roomDetails.items] : []);
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setIsEditMode(true);
  }

  function cancelEditMode() {
    setIsEditMode(false);
    setSelectedItem(null);
    setSelectedPlacedItem(null);
    setPendingItems([]);
  }

  async function saveEditMode() {
    setIsSaving(true);
    try {
      const body = pendingItems.map(ri => ({
        itemId: ri.itemId._id,
        position: ri.position,
        orientation: ri.orientation,
        state: ri.state,
      }));
      await api.patch(`/api/v1/rooms/${roomId}/items`, { items: body });
      setIsEditMode(false);
      setSelectedItem(null);
      setSelectedPlacedItem(null);
    } catch (e) {
      console.error('Failed to save room layout', e);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectInventoryItem(item: Item | null) {
    setSelectedItem(item);
    setSelectedPlacedItem(null);
  }

  function removeSelectedPlacedItem() {
    if (!selectedPlacedItem) return;
    setPendingItems(current => current.filter(ri => ri !== selectedPlacedItem));
    setSelectedPlacedItem(null);
  }

  function handleGridCellPress(gx: number, gy: number) {
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

  /**
   * When an item with an action is tapped: walk to the nearest adjacent cell,
   * then apply the action animation (stored in local character state).
   */
  function handleItemActionPress(roomItem: RoomItem) {
    const me = roomCharacters[userId];
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

  function handleRoomTap(event: GestureResponderEvent, zoomableViewEvent: ZoomableViewEvent) {
    if (isEditMode) return;

    const { zoomLevel, offsetX, offsetY } = zoomableViewEvent;
    // Use pageX/Y (absolute screen coords) minus the canvas's measured screen position.
    // locationX/Y from the ZoomableView's onSingleTap can be unreliable on Android
    // (new arch PanResponder may report coords in a different space), while pageX/Y is always
    // absolute and canvas offset is measured via measureInWindow.
    const tapX = event.nativeEvent.pageX - canvasPageOffset.current.x;
    const tapY = event.nativeEvent.pageY - canvasPageOffset.current.y;
    const contentX = (tapX - offsetX) / zoomLevel;
    const contentY = (tapY - offsetY) / zoomLevel;

    const { gx, gy } = screenToGrid(contentX, contentY, origin);
    // Clamp to floor bounds — characters use float positions, not cell centres
    const destGx = Math.max(0, Math.min(roomDimensions.x, gx));
    const destGy = Math.max(0, Math.min(roomDimensions.y, gy));

    if (!roomCharacters[userId]) return;
    walkMeTo(destGx, destGy);
  }

  function onMessageSubmit(message: string) {
    sendMessage(message);
    pushChatMessage(userId, message);
  }

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
      // Measure absolute screen position so handleRoomTap can convert pageX/Y to canvas coords.
      canvasRef.current?.measureInWindow((x, y) => {
        canvasPageOffset.current = { x, y };
      });
    }
  };

  if (isRoomLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (roomError || !roomDetails) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View>
          <Button title="Failed to load room." />
        </View>
      </View>
    );
  }

  // Unified depth-sorted renderable list (painter's algorithm)
  type Renderable =
    | { kind: 'character'; data: RoomCharacter; depth: number }
    | { kind: 'item'; data: RoomItem; depth: number };

  const activeItems = isEditMode ? pendingItems : (roomDetails?.items ?? []);

  const renderables: Renderable[] = [
    ...Object.values(roomCharacters).map(c => ({
      kind: 'character' as const,
      data: c,
      // +0.5 ensures characters render in front of floor items at the same tile
      depth: c.position.x + c.position.y + 0.5,
    })),
    ...activeItems.map(ri => ({
      kind: 'item' as const,
      data: ri,
      // Use item center so large multi-tile items sort in front of items behind them
      depth: ri.position.x + ri.position.y
        + ri.itemId.dimensions.x / 2
        + ri.itemId.dimensions.y / 2,
    })),
  ].sort((a, b) => a.depth - b.depth);

  return (
    <View style={styles.container}>
      {isEditMode ? (
        <EditModeToolbar
          topInset={insets.top}
          isSaving={isSaving}
          onSave={saveEditMode}
          onCancel={cancelEditMode}
          selectedPlacedItem={selectedPlacedItem}
          onRemovePlacedItem={removeSelectedPlacedItem}
        />
      ) : (
        <View style={[styles.roomHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.roomHeaderTitle} numberOfLines={1}>{roomDetails.name}</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      <View ref={canvasRef} style={{ flex: 1 }} onLayout={onCanvasLayout}>
        {canvasSize.width > 0 && (
          <ReactNativeZoomableView
            style={{ width: canvasSize.width, height: canvasSize.height }}
            maxZoom={1.5}
            minZoom={0.5}
            zoomStep={0.5}
            initialZoom={1}
            bindToBorders={true}
            onSingleTap={handleRoomTap}
          >
            <View style={{ width: canvasSize.width, height: canvasSize.height }}>
              <RoomBackdrop
                roomDetails={roomDetails}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
              />

              {renderables.map(r =>
                r.kind === 'character' ? (
                  <Character
                    key={`char-${r.data.user._id}`}
                    {...r.data}
                    origin={origin}
                    avatar={r.data.user._id === userId && selectedAvatar ? selectedAvatar : undefined}
                  />
                ) : (
                  <RoomItemView
                    key={`item-${r.data.itemId._id}-${r.data.position.x}-${r.data.position.y}`}
                    roomItem={r.data}
                    origin={origin}
                    onActionPress={isEditMode ? undefined : handleItemActionPress}
                    isSelectedInEditMode={isEditMode && selectedPlacedItem === r.data}
                  />
                ),
              )}

              {isEditMode && canvasSize.width > 0 && (
                <GridOverlay
                  roomDimensions={roomDimensions}
                  origin={origin}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  pendingItems={pendingItems}
                  selectedItem={selectedItem}
                  onCellPress={handleGridCellPress}
                />
              )}
            </View>
          </ReactNativeZoomableView>
        )}

        {isOwner && !isEditMode && (
          <EditModeButton onPress={enterEditMode} />
        )}
      </View>

      {isEditMode
        ? <InventoryDrawer selectedItem={selectedItem} onSelectItem={handleSelectInventoryItem} pendingItems={pendingItems} />
        : (
          <>
            <TypingIndicator typingUserIds={typingUserIds} />
            <ChatInput onTyping={sendTyping} onSubmit={onMessageSubmit} />
          </>
        )
      }
    </View>
  );
}

export default Room;
