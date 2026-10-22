import type { RoomEngine } from './core/contract';
import { skiaEngine } from './engines/skia';
import { RoomShell } from './session/RoomShell';
import { useRoomSession } from './session/useRoomSession';

// The only engine since the legacy View-based one was deleted (2026-10-22). The contract
// stays, so another engine can be swapped in here.
const engine: RoomEngine = skiaEngine;

export function Room({ roomId }: Readonly<{ roomId: string }>) {
  const session = useRoomSession(roomId, engine.capabilities);
  const { Renderer } = engine;

  return (
    <RoomShell session={session}>
      {session.scene && (
        <Renderer
          scene={session.scene}
          actors={session.actors}
          localActorId={session.localActorId}
          mode={session.mode}
          edit={session.edit}
          onFloorTap={session.intents.walkTo}
          onItemTap={session.intents.interactWith}
          onCellTap={session.intents.editCell}
          onActionComplete={session.onActionComplete}
        />
      )}
    </RoomShell>
  );
}

export default Room;
