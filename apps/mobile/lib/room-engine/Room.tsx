import { getRoomEngine } from './core/registry';
import { RoomShell } from './session/RoomShell';
import { useRoomSession } from './session/useRoomSession';

// Chosen once per bundle from EXPO_PUBLIC_ROOM_ENGINE.
const engine = getRoomEngine();

export function Room({ roomId }: Readonly<{ roomId: string }>) {
  const session = useRoomSession(roomId);
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
