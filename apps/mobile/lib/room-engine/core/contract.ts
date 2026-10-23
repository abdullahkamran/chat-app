import type { ComponentType } from 'react';

import type { GridPoint } from '@/constants/grid';
import type {
  ActorAction,
  ActorActionKind,
  Avatar,
  Dimensions,
  Door,
  Facing,
  Item,
  Position,
  RoomItem,
  RoomTheme,
  User,
} from '@chat-app/shared-types';

/**
 * Room engine contract.
 *
 * An engine is a pure view: it receives room state as props and reports user
 * intents through callbacks, always in grid coordinates. The room session owns
 * what is true (positions, actions, messages); the engine owns how it looks
 * (projection, camera, interpolation, animation, hit-testing).
 *
 * Engines must never touch the socket, REST API or React Query.
 */

/** Room state that changes rarely. */
export interface RoomScene {
  dimensions: Dimensions;
  theme: RoomTheme;
  /** Placed items. While editing, this is the pending (unsaved) layout. */
  items: RoomItem[];
  doors: Door[];
}

export interface ChatBubble {
  id: string;
  text: string;
  /** When it was sent, by this device's clock (`Date.now()`); earlier for one seen late, from the presence snapshot. */
  sentAt: number;
}

/** A character in the room. Changes often. */
export interface ActorState {
  id: User['_id'];
  user: User;
  /**
   * The user's selected avatar, owned by the session: auth for the local actor, fetched
   * for others on each enter and avatar change. Undefined while loading; engines draw a
   * placeholder and never fetch it themselves.
   */
  avatar?: Avatar;
  /**
   * Logical position. While walking, this is the end of the path. While sitting, it is
   * the seat's cushion point, with `z` the seat height (see core/seats.ts).
   */
  position: Position;
  facing: Facing;
  action: ActorAction;
  /** Append-only list of chat messages; the engine decides how long each stays visible. */
  bubbles: ChatBubble[];
  isTyping: boolean;
}

export interface EditState {
  /** Inventory item chosen for placement. */
  selectedItem: Item | null;
  /** Placed item picked up for moving or removal. */
  selectedPlaced: RoomItem | null;
}

export type RoomMode = 'play' | 'edit';

export interface RoomRendererProps {
  scene: RoomScene;
  actors: Readonly<Record<string, ActorState>>;
  localActorId: string;
  mode: RoomMode;
  edit: EditState;
  /** Floor tapped in play mode. Fractional grid coordinates. */
  onFloorTap(point: GridPoint): void;
  /** An interactive item tapped in play mode. */
  onItemTap(item: RoomItem): void;
  /** A grid cell tapped in edit mode. Integer grid coordinates. */
  onCellTap(cell: GridPoint): void;
  /** The engine finished playing a non-looping action (e.g. a walk reached its destination). */
  /** `finished` is the action object that ended, so the session can ignore a report for one it has since replaced. */
  onActionComplete(actorId: string, action: ActorActionKind, finished?: ActorAction): void;
}

export interface EngineCapabilities {
  /** Distinct facings the engine can draw. Others are approximated. */
  facings: 2 | 4;
  actions: readonly ActorActionKind[];
  editMode: boolean;
}

export interface RoomEngine {
  id: string;
  capabilities: EngineCapabilities;
  Renderer: ComponentType<RoomRendererProps>;
}
