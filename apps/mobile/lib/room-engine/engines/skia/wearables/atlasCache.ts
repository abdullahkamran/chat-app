import { Skia, type SkImage } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';

import { SERVER_ORIGIN } from '@/utils/config';
import type { WearableAsset } from '@chat-app/shared-types';

/**
 * Wearable atlases: downloaded once per atlasVersion into the app's cache directory,
 * then decoded once per app session. A re-pack changes atlasVersion, so a new file is
 * fetched and the old one is simply never read again (the OS may purge the cache dir).
 */
const dir = new Directory(Paths.cache, 'wearables');
const decoded = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | null>>();

function cacheKey(asset: WearableAsset): string {
  return `${asset.atlasUrl}@${asset.atlasVersion}`;
}

function cacheFile(asset: WearableAsset): File {
  const name = asset.atlasUrl.split('/').pop()?.replace(/\.png$/, '') ?? 'atlas';
  return new File(dir, `${name}-${asset.atlasVersion}.png`);
}

async function download(asset: WearableAsset): Promise<SkImage | null> {
  const file = cacheFile(asset);
  if (!file.exists) {
    dir.create({ idempotent: true, intermediates: true });
    const url = `${SERVER_ORIGIN}${asset.atlasUrl}?v=${asset.atlasVersion}`;
    await File.downloadFileAsync(url, file, { idempotent: true });
  }
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(file.uri));
  if (!image) {
    // A truncated or bad download; drop it so the next session fetches it again.
    file.delete();
    return null;
  }
  return image;
}

/** The decoded atlas, or null if it can't be fetched or decoded (retried on the next call). */
export function loadAtlas(asset: WearableAsset): Promise<SkImage | null> {
  const key = cacheKey(asset);
  const hit = decoded.get(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = download(asset)
    .then(image => {
      if (image) decoded.set(key, image);
      return image;
    })
    .catch(err => {
      console.warn(`[skia engine] could not load wearable atlas ${key}`, err);
      return null;
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
