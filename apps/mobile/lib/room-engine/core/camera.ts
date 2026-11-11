import type { CameraCommand, CameraLink } from './contract';

/** Queues a camera command for the engine (see CameraLink). Call on the JS thread. */
export function sendCameraCommand(link: CameraLink, cmd: CameraCommand) {
  link.command.set({ seq: link.command.get().seq + 1, cmd });
}
