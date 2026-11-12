import type { ComponentType } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { GridPoint, WallCell } from '@/constants/grid';
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

/** The cell an edit-mode tap landed on: a floor cell (integer grid coordinates) or a wall cell. */
export type EditCell = ({ surface: 'floor' } & GridPoint) | ({ surface: 'wall' } & WallCell);

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
   * A tap in edit mode. `cell` is the floor or wall cell under it, null when it missed
   * both. `item` is the front-most placed item whose art is under the tap, interactive
   * or not: tall art covers cells behind its own, so the cell alone can't tell which item
   * was meant. Not called when both are null.
   */
  onCellTap(cell: EditCell | null, item: RoomItem | null): void;
  /** The engine finished playing a non-looping action (e.g. a walk reached its destination). */
  /** `finished` is the action object that ended, so the session can ignore a report for one it has since replaced. */
  onActionComplete(actorId: string, action: ActorActionKind, finished?: ActorAction): void;
  /**
   * Experimental joystick steering of the local actor (see joystick/). Absent when off.
   * An engine that doesn't support it ignores it, and tap-to-walk still works.
   */
  steering?: SteeringInput;
  /** The shell's link to the camera: its buttons, the covered part of the room, and state back. */
  camera: CameraLink;
}

/**
 * What the camera is doing. The camera is per device and never networked.
 * - `intro`: entering the room, showing everyone before gliding to the local actor.
 * - `follow`: keeping the local actor in view.
 * - `free`: the user panned; the camera stays put until they walk or ask for it back.
 * - `overview`: framing everyone in the room, kept up to date as they move.
 * - `focus`: briefly showing one actor, then going back.
 */
export type CameraMode = 'intro' | 'follow' | 'free' | 'overview' | 'focus';

export type CameraCommand =
  | { kind: 'toggleOverview' }
  | { kind: 'followMe' }
  | { kind: 'focus'; actorId: string };

/** What the shell needs to know to draw its camera buttons. */
export interface CameraViewState {
  mode: CameraMode;
  /** The local actor is out of view. */
  localOffscreen: boolean;
}

/**
 * Camera input from the shell, and state back. The engine owns the camera itself:
 * gestures, following, framing.
 */
export interface CameraLink {
  /** The latest command; the engine acts on each new `seq` once. Write with `sendCameraCommand`. */
  command: SharedValue<{ seq: number; cmd: CameraCommand | null }>;
  /** Pixels at the bottom of the room hidden by the keyboard or the open transcript. */
  bottomInset: SharedValue<number>;
  /** Called on the JS thread when the mode or `localOffscreen` changes. */
  onChange(state: CameraViewState): void;
}

/** A point on the floor, in fractional grid coordinates. */
export interface FloorPoint {
  x: number;
  y: number;
}

/**
 * Joystick input for the local actor. The engine moves the actor itself every frame while
 * the stick is pushed, and reports to the session, which owns what is true.
 */
export interface SteeringInput {
  /** Stick direction in screen space (x right, y down), unit length; (0, 0) at rest. Written on the UI thread. */
  stick: SharedValue<{ x: number; y: number }>;
  /** The local actor started moving under the stick. */
  onStart(): void;
  /** While moving, every STEER_REPORT_MS: where it is drawn now, and where it will be shortly. */
  onMove(at: FloorPoint, ahead: FloorPoint): void;
  /** The stick came back to rest and the actor stopped here. */
  onStop(at: FloorPoint): void;
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
