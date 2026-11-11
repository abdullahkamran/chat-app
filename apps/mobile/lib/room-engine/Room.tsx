import type { RoomEngine } from './core/contract';
import { skiaEngine } from './engines/skia';
import { Joystick, useJoystick } from './joystick';
import { RoomShell } from './session/RoomShell';
import { useRoomCamera } from './session/useRoomCamera';
import { useRoomSession } from './session/useRoomSession';

// The only engine since the legacy View-based one was deleted (2026-10-22). The contract
// stays, so another engine can be swapped in here.
const engine: RoomEngine = skiaEngine;

export function Room({ roomId }: Readonly<{ roomId: string }>) {
  const session = useRoomSession(roomId, engine.capabilities);
  // Experimental, off unless EXPO_PUBLIC_ROOM_JOYSTICK=1.
  const steering = useJoystick(session);
  const camera = useRoomCamera();
  const { Renderer } = engine;

  return (
    <RoomShell session={session} camera={camera} controls={steering && <Joystick stick={steering.stick} />}>
      {session.scene && (
        <Renderer
          scene={session.scene}
          actors={session.actors}
          localActorId={session.localActorId}
          mode={session.mode}
          edit={session.edit}
          effects={session.effects}
          onActorTap={session.intents.tapActor}
          onFloorTap={session.intents.walkTo}
          onItemTap={session.intents.interactWith}
          onCellTap={session.intents.editCell}
          onActionComplete={session.onActionComplete}
          steering={steering ?? undefined}
          camera={camera.link}
        />
      )}
    </RoomShell>
  );
}

export default Room;
