import { Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { theme } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Avatar, AvatarItem, WearableAsset } from '@chat-app/shared-types';
import type { ActorState } from '../../../core/contract';
import type { AvatarArt } from '../skeleton/avatarArt';
import { getAvatarArt } from '../skeleton/programmerArt';
import { isStressActor } from '../useStressActors';
import { loadAtlas } from './atlasCache';
import { composeAvatar, type WornPart } from './composeAvatar';

/** Art key for the tinted programmer-art avatar: the fallback while an outfit loads. */
export const PLACEHOLDER_ART = 'placeholder';

/** Avatar parts, back to front where two share a slot layer (they don't today). */
const PARTS = [
  'skin', 'face', 'eye', 'nose', 'mouth', 'facialHair', 'hair',
  'headwear', 'facewear', 'tops', 'bottoms', 'footwear', 'wristwear',
] as const satisfies readonly (keyof Avatar)[];

interface Outfit {
  /** Identifies the composed art; equal outfits share one atlas. */
  key: string;
  assets: WearableAsset[];
  skin: string;
  colors: (string | null)[];
}

/** The selected variant's packed art for each worn part, or null when nothing is packed yet. */
function outfitOf(avatar: Avatar | null | undefined): Outfit | null {
  if (!avatar) return null;
  const skin = avatar.skin?.variants[0]?.color ?? theme.colors.avatarPlaceholderSkin;
  const assets: WearableAsset[] = [];
  const colors: (string | null)[] = [];
  for (const part of PARTS) {
    const item = avatar[part] as AvatarItem | undefined;
    const variant = item?.variants[0];
    if (!variant?.rigAsset) continue;
    assets.push(variant.rigAsset);
    colors.push(part === 'skin' ? null : variant.color ?? null);
  }
  if (assets.length === 0) return null;
  const key = [skin, ...assets.map((a, i) => `${a.atlasUrl}@${a.atlasVersion}#${colors[i] ?? ''}`)].join('|');
  return { key, assets, skin, colors };
}

/** Composed outfits for the app's lifetime, by outfit key. */
const composed = new Map<string, AvatarArt>();
const composing = new Map<string, Promise<void>>();
/** Outfits whose atlases failed to load this visit; not retried until the next room visit. */
const failed = new Set<string>();
/** Avatars fetched by user id for actors that arrive without one, for this room visit. */
const fetched = new Map<string, Avatar | null>();
const fetching = new Map<string, Promise<void>>();

function fetchAvatar(userId: string): Promise<void> {
  const inFlight = fetching.get(userId);
  if (inFlight) return inFlight;
  const promise = api.get<Avatar>(`/api/v1/users/${userId}/avatar`)
    .then(avatar => { fetched.set(userId, avatar ?? null); })
    .catch(err => {
      console.warn(`[skia engine] no avatar for ${userId}`, err);
      fetched.set(userId, null);
    })
    .finally(() => fetching.delete(userId));
  fetching.set(userId, promise);
  return promise;
}

function compose(outfit: Outfit): Promise<void> {
  const inFlight = composing.get(outfit.key);
  if (inFlight) return inFlight;
  const promise = Promise.all(outfit.assets.map(loadAtlas))
    .then(images => {
      const skinTint = Skia.Color(outfit.skin);
      const parts: WornPart[] = [];
      images.forEach((image, i) => {
        if (!image) return;
        const color = outfit.colors[i];
        parts.push({ asset: outfit.assets[i], image, skinTint, colorTint: color ? Skia.Color(color) : null });
      });
      // Never cache a partly dressed avatar: it would stick for the app's lifetime.
      if (parts.length === outfit.assets.length) composed.set(outfit.key, composeAvatar(parts));
      else failed.add(outfit.key);
    })
    .catch(err => {
      console.warn('[skia engine] could not compose avatar', err);
      failed.add(outfit.key);
    })
    .finally(() => composing.delete(outfit.key));
  composing.set(outfit.key, promise);
  return promise;
}

/** The actor's own avatar when it carries rig art, else the one fetched by user id. */
function avatarFor(actor: ActorState): Avatar | null | undefined {
  if (outfitOf(actor.avatar)) return actor.avatar;
  return fetched.get(actor.id);
}

/**
 * Dressed-avatar art for each actor. Returns every art in use by key, and each actor's
 * key; an actor shows the programmer-art placeholder until its outfit is composed.
 * Keys only change when an outfit finishes, so the frame loop's art input stays put
 * while actors move.
 */
export function useAvatarArts(actors: Readonly<Record<string, ActorState>>) {
  const [version, setVersion] = useState(0);

  const result = useMemo(() => {
    const artKeys: Record<string, string> = {};
    const toFetch: string[] = [];
    const toCompose: Outfit[] = [];

    for (const actor of Object.values(actors)) {
      artKeys[actor.id] = PLACEHOLDER_ART;
      if (isStressActor(actor.id)) continue;
      const avatar = avatarFor(actor);
      if (avatar === undefined) {
        toFetch.push(actor.id);
        continue;
      }
      const outfit = outfitOf(avatar);
      if (!outfit || failed.has(outfit.key)) continue;
      if (composed.has(outfit.key)) artKeys[actor.id] = outfit.key;
      else toCompose.push(outfit);
    }
    return { artKeys, toFetch, toCompose };
    // `version` marks newly fetched avatars and composed outfits; the caches live outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actors, version]);

  const { artKeys, toFetch, toCompose } = result;

  // Rebuilt only when the set of outfits in use changes, not as actors move.
  const inUse = [...new Set(Object.values(artKeys))].sort().join('\n');
  const arts = useMemo(() => {
    const out: Record<string, AvatarArt> = { [PLACEHOLDER_ART]: getAvatarArt() };
    for (const key of inUse.split('\n')) {
      const art = composed.get(key);
      if (art) out[key] = art;
    }
    return out;
  }, [inUse]);

  useEffect(() => {
    if (toFetch.length === 0 && toCompose.length === 0) return;
    let live = true;
    const bump = () => {
      if (live) setVersion(v => v + 1);
    };
    toFetch.forEach(id => void fetchAvatar(id).then(bump));
    toCompose.forEach(outfit => void compose(outfit).then(bump));
    return () => {
      live = false;
    };
  }, [toFetch, toCompose]);

  // Avatars can change between visits; fetch them afresh next time.
  useEffect(() => () => {
    fetched.clear();
    failed.clear();
  }, []);

  return { arts, artKeys };
}
