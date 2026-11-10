import { useSharedValue } from 'react-native-reanimated';

import type { SteeringInput } from '../core/contract';
import type { RoomSession } from '../session/useRoomSession';
import { JOYSTICK_ENABLED } from './config';
import { STICK_REST, type StickVector } from './steerMath';

/**
 * Wires the joystick to the room session. Null when the joystick is off, so the
 * renderer gets no steering input and the shell shows no stick.
 */
export function useJoystick(session: RoomSession): SteeringInput | null {
  const stick = useSharedValue<StickVector>(STICK_REST);
  if (!JOYSTICK_ENABLED) return null;
  const { steerStart, steerMove, steerStop } = session.intents;
  return { stick, onStart: steerStart, onMove: steerMove, onStop: steerStop };
}
