import * as SecureStore from 'expo-secure-store';

import { clampZoom } from './useCamera';

/** The room camera's zoom, kept on this device only. */
const ZOOM_KEY = 'room-camera-zoom';

/** The zoom the user last pinched to, or null when none is saved. */
export async function loadZoom(): Promise<number | null> {
  try {
    const value = Number.parseFloat((await SecureStore.getItemAsync(ZOOM_KEY)) ?? '');
    return Number.isFinite(value) ? clampZoom(value) : null;
  } catch {
    return null;
  }
}

export function saveZoom(zoom: number): void {
  SecureStore.setItemAsync(ZOOM_KEY, zoom.toFixed(3)).catch(() => {});
}
