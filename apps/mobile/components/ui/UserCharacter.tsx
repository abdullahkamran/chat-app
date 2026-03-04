import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar, AvatarItem } from '@chat-app/shared-types';
import { api } from '@/lib/api';
import { theme } from '@/constants/theme';
import { resolveAvatarSource } from '@/constants/avatarAssets';

// ── Layer ordering ─────────────────────────────────────────────────────────────
// Defines back-to-front compositing order for avatar parts.
export const AVATAR_PART_RENDER_ORDER = [
  'skin',
  'face',
  'bottoms',
  'tops',
  'footwear',
  'wristwear',
  'facialHair',
  'nose',
  'eye',
  'mouth',
  'hair',
  'headwear',
  'facewear',
] as const;

export type AvatarPartKey = (typeof AVATAR_PART_RENDER_ORDER)[number];

// ── Public types ───────────────────────────────────────────────────────────────

/** A single composited image layer for the avatar display. */
export interface AvatarLayer {
  key: string;
  sourceUrl: string;
}

/**
 * Convert a fully-populated Avatar (from API) to a flat layer list.
 * The API returns each part with `variants[0]` = the selected variant.
 */
export function avatarToLayers(avatar: Avatar): AvatarLayer[] {
  return AVATAR_PART_RENDER_ORDER.flatMap((key) => {
    const part = avatar[key as keyof Avatar] as (AvatarItem & { variants: Array<{ sourceUrl: string }> }) | undefined;
    const sourceUrl = part?.variants?.[0]?.sourceUrl;
    return sourceUrl ? [{ key, sourceUrl }] : [];
  });
}

// ── Props (discriminated union) ────────────────────────────────────────────────

type UserCharacterProps = {
  /** Display height in dp. Width is calculated automatically (2:3 ratio). */
  size?: number;
} & (
  | { userId: string; avatarId?: string } // fetch from API
  | { avatar: Avatar }                    // pre-loaded Avatar object
  | { layers: AvatarLayer[] }             // raw layers (editor preview)
);

// ── Skeleton ───────────────────────────────────────────────────────────────────

const Skeleton = ({ size }: { size: number }) => {
  const w = Math.round(size * (2 / 3));
  return (
    <View style={[styles.skeleton, { width: w, height: size }]}>
      <View style={[styles.skeletonHead, { width: w * 0.5, height: w * 0.5, borderRadius: w * 0.25 }]} />
      <View style={[styles.skeletonBody, { width: w * 0.65, height: size * 0.42 }]} />
      <View style={[styles.skeletonLegs, { width: w * 0.5, height: size * 0.18 }]} />
    </View>
  );
};

// ── Core renderer ──────────────────────────────────────────────────────────────

function AvatarLayersView({ layers, size }: { layers: AvatarLayer[]; size: number }) {
  const w = Math.round(size * (2 / 3));
  return (
    <View style={{ width: w, height: size }}>
      {layers.map(({ key, sourceUrl }) => {
        const source = resolveAvatarSource(sourceUrl);
        if (!source) return null;
        return (
          <Image
            key={key}
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        );
      })}
    </View>
  );
}

// ── Fetched variant ────────────────────────────────────────────────────────────

function FetchedUserCharacter({
  userId,
  avatarId,
  size,
}: {
  userId: string;
  avatarId?: string;
  size: number;
}) {
  const [layers, setLayers] = useState<AvatarLayer[] | null>(null);

  useEffect(() => {
    const endpoint = avatarId
      ? `/api/v1/users/${userId}/avatar/${avatarId}`
      : `/api/v1/users/${userId}/avatar`;
    api
      .get<Avatar>(endpoint)
      .then((avatar) => setLayers(avatarToLayers(avatar)))
      .catch(() => setLayers([]));
  }, [userId, avatarId]);

  if (layers === null) return <Skeleton size={size} />;
  if (layers.length === 0) return <Skeleton size={size} />;
  return <AvatarLayersView layers={layers} size={size} />;
}

// ── Public component ───────────────────────────────────────────────────────────

export default function UserCharacter(props: UserCharacterProps) {
  const size = props.size ?? 200;

  if ('layers' in props) {
    if (props.layers.length === 0) return <Skeleton size={size} />;
    return <AvatarLayersView layers={props.layers} size={size} />;
  }

  if ('avatar' in props) {
    const layers = avatarToLayers(props.avatar);
    if (layers.length === 0) return <Skeleton size={size} />;
    return <AvatarLayersView layers={layers} size={size} />;
  }

  return <FetchedUserCharacter userId={props.userId} avatarId={props.avatarId} size={size} />;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  skeleton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  skeletonHead: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  skeletonBody: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
  },
  skeletonLegs: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 4,
  },
});
