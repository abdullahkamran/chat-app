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

/** Something thrown by an interactive emote. */
export type PropId = 'tomato' | 'snowball';

/**
 * A short-lived visual the session asks the engine to draw. The engine starts its clock
 * when the effect first appears; the session removes it once it is over.
 */
export interface RoomEffect {
  id: string;
  kind: 'throw';
  prop: PropId;
  /** Thrown from this actor's hand at the target's face, which it follows if they move. */
  fromId: string;
  toId: string;
  /** Time in the air, then time the splat stays on the target. */
  flightMs: number;
  splatMs: number;
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
  /** Thrown props and similar, drawn over the room. */
  effects: readonly RoomEffect[];
  /**
   * An avatar tapped in play mode (the front-most under the tap). Returns whether the
   * session used the tap; if not, the engine handles it as an item or floor tap.
   */
  onActorTap(actorId: string): boolean;
  /** Floor tapped in play mode. Fractional grid coordinates. */
  onFloorTap(point: GridPoint): void;
  /** An interactive item tapped in play mode. */
  onItemTap(item: RoomItem): void;
  /**
   * A grid cell tapped in edit mode. Integer grid coordinates. `item` is the front-most
   * placed item whose art is under the tap, interactive or not: tall art covers cells
   * behind its own, so the floor cell alone can't tell which item was meant.
   */
  onCellTap(cell: GridPoint, item: RoomItem | null): void;
  /** The engine finished playing a non-looping action (e.g. a walk reached its destination). */
  /** `finished` is the action object that ended, so the session can ignore a report for one it has since replaced. */
  onActionComplete(actorId: string, action: ActorActionKind, finished?: ActorAction): void;
}

export interface EngineCapabilities {
  /** Distinct facings the engine can draw. Others are approximated. */
  facings: 2 | 4;
  actions: readonly ActorActionKind[];
  /**
   * Emotes the engine can play over the sit pose (upper body only). A seated user picking
   * one stays seated; any other emote stands them up first.
   */
  seatedEmotes?: readonly string[];
  editMode: boolean;
}

export interface RoomEngine {
  id: string;
  capabilities: EngineCapabilities;
  Renderer: ComponentType<RoomRendererProps>;
}
