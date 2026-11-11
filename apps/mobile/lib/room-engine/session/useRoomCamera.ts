import { useCallback, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { sendCameraCommand } from '../core/camera';
import type { CameraCommand, CameraLink, CameraViewState } from '../core/contract';

export interface RoomCamera {
  /** Passed to the engine. */
  link: CameraLink;
  /** The camera's mode and whether the local actor is in view, for the shell's buttons. */
  state: CameraViewState;
  toggleOverview(): void;
  followMe(): void;
  focus(actorId: string): void;
}

/** The shell's side of the camera: buttons send commands, the engine reports back. */
export function useRoomCamera(): RoomCamera {
  const command = useSharedValue<{ seq: number; cmd: CameraCommand | null }>({ seq: 0, cmd: null });
  const bottomInset = useSharedValue(0);
  const [state, setState] = useState<CameraViewState>({ mode: 'intro', localOffscreen: false });

  const onChange = useCallback((next: CameraViewState) => {
    setState(prev => (prev.mode === next.mode && prev.localOffscreen === next.localOffscreen ? prev : next));
  }, []);
  const link = useMemo<CameraLink>(() => ({ command, bottomInset, onChange }), [command, bottomInset, onChange]);

  return useMemo(() => ({
    link,
    state,
    toggleOverview: () => sendCameraCommand(link, { kind: 'toggleOverview' }),
    followMe: () => sendCameraCommand(link, { kind: 'followMe' }),
    focus: (actorId: string) => sendCameraCommand(link, { kind: 'focus', actorId }),
  }), [link, state]);
}
