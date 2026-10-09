import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';

import { resolveItemSource } from '@/constants/avatarAssets';

/**
 * App-lifetime cache of decoded Skia images, keyed by catalog asset URL.
 *
 * Skia's useImage fetches and decodes on every mount and keeps nothing, so large
 * theme images (the floor is ~2500 px) reappeared slowly on each room entry and
 * every copy of an item decoded its own image. Here each asset loads once.
 */
const decoded = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | null>>();

function uriFor(assetUrl: string): string | null {
  const source = resolveItemSource(assetUrl);
  if (source == null) return null;
  if (typeof source === 'number') return RNImage.resolveAssetSource(source).uri;
  if (typeof source === 'string') return source;
  return 'uri' in source && typeof source.uri === 'string' ? source.uri : null;
}

export function loadSkImage(assetUrl: string): Promise<SkImage | null> {
  const hit = decoded.get(assetUrl);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(assetUrl);
  if (inFlight) return inFlight;

  const uri = uriFor(assetUrl);
  if (!uri) return Promise.resolve(null);

  const promise = Skia.Data.fromURI(uri)
    .then(data => Skia.Image.MakeImageFromEncoded(data))
    .then(image => {
      if (image) decoded.set(assetUrl, image);
      return image;
    })
    .catch(err => {
      console.warn(`[skia engine] could not load ${assetUrl}`, err);
      return null;
    })
    .finally(() => pending.delete(assetUrl));
  pending.set(assetUrl, promise);
  return promise;
}

/** Start loading assets before anything draws them. */
export function preloadSkImages(assetUrls: Iterable<string | undefined>) {
  for (const url of assetUrls) if (url) void loadSkImage(url);
}

/** The decoded image for a catalog asset; available on the first render once cached. */
export function useSkImage(assetUrl: string | undefined): SkImage | null {
  const [loaded, setLoaded] = useState<{ url: string; image: SkImage | null } | null>(null);
  const cached = assetUrl ? decoded.get(assetUrl) ?? null : null;
  const renderedCached = cached !== null;

  useEffect(() => {
    // Also covers an image that finished decoding between this render and the effect.
    if (!assetUrl || renderedCached) return;
    let live = true;
    loadSkImage(assetUrl).then(image => {
      if (live) setLoaded({ url: assetUrl, image });
    });
    return () => {
      live = false;
    };
  }, [assetUrl, renderedCached]);

  if (assetUrl && loaded?.url === assetUrl) return loaded.image;
  return cached;
}
