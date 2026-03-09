import { DimensionValue, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
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

// ── Layout type ────────────────────────────────────────────────────────────────
type PartLayout = { top: DimensionValue; left: DimensionValue; width: DimensionValue; height: DimensionValue };

// ── Body layer layout ──────────────────────────────────────────────────────────
// Per-part bounding box as % of character container (width = size*2/3, height = size).
// Does NOT include face features — those live in FACE_FEATURE_LAYOUT below.
const LAYER_LAYOUT: Partial<Record<AvatarPartKey, PartLayout>> = {
  // skin must match face bounds exactly so the color fills the entire head shape
  skin:     { top: '2%',  left: '14%', width: '72%',  height: '34%' },
  face:     { top: '2%',  left: '14%', width: '72%',  height: '34%' },
  hair:     { top: '0%',  left: '10%', width: '80%',  height: '38%' },
  headwear: { top: '0%',  left: '6%',  width: '88%',  height: '32%' },
  tops:     { top: '28%', left: '2%',  width: '96%',  height: '46%' },
  wristwear:{ top: '46%', left: '2%',  width: '36%',  height: '20%' },
  bottoms:  { top: '58%', left: '4%',  width: '92%',  height: '38%' },
  footwear: { top: '86%', left: '8%',  width: '84%',  height: '14%' },
  // facewear sits above hair/headwear, positioned in character container space
  facewear: { top: '8%',  left: '6%',  width: '88%',  height: '16%' },
};

// ── Face container bounds ──────────────────────────────────────────────────────
// Position of the face-feature container within the character container.
// Must match LAYER_LAYOUT['face'] exactly.
const FACE_BOUNDS: PartLayout = { top: '2%', left: '14%', width: '72%', height: '34%' };

// ── Face feature layout ────────────────────────────────────────────────────────
// Positions are relative to the face container, NOT the character container.
// Face container: top=2%, left=14%, width=72%, height=34% of character.
// Derived via:
//   new_top%  = (char_top%  - 2)  / 34 * 100
//   new_left% = (char_left% - 14) / 72 * 100
//   new_w%    = char_w%  / 72 * 100
//   new_h%    = char_h%  / 34 * 100
// Negative left values are valid — some SVGs extend slightly outside face bounds.
const FACE_FEATURE_LAYOUT: Partial<Record<AvatarPartKey, PartLayout>> = {
  eye:        { top: '24%', left: '2%',  width: '96%', height: '22%' },
  nose:       { top: '49%', left: '27%', width: '46%', height: '26%' },
  mouth:      { top: '68%', left: '10%', width: '80%', height: '20%' },
  facialHair: { top: '59%', left: '10%', width: '80%', height: '30%' },
};

// Sets used to route layers into the correct render pass
const FACE_FEATURE_KEYS = new Set<string>(['facialHair', 'nose', 'eye', 'mouth']);
const HAIR_KEYS         = new Set<string>(['hair', 'headwear']);
const TOP_OVERLAY_KEYS  = new Set<string>(['facewear']);

export type AvatarPartKey = (typeof AVATAR_PART_RENDER_ORDER)[number];

// ── Public types ───────────────────────────────────────────────────────────────

/** A single composited layer for the avatar display. Either an SVG image or a solid color fill. */
export interface AvatarLayer {
  key: string;
  sourceUrl?: string;
  color?: string;
}

/**
 * Convert a fully-populated Avatar (from API) to a flat layer list.
 * The API returns each part with `variants[0]` = the selected variant.
 */
export function avatarToLayers(avatar: Avatar): AvatarLayer[] {
  return AVATAR_PART_RENDER_ORDER.flatMap((key): AvatarLayer[] => {
    const part = avatar[key as keyof Avatar] as (AvatarItem & { variants: Array<{ sourceUrl?: string; color?: string }> }) | undefined;
    const variant = part?.variants?.[0];
    if (!variant) return [];
    if (variant.sourceUrl) return [{ key, sourceUrl: variant.sourceUrl }];
    if (variant.color) return [{ key, color: variant.color }];
    return [];
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

// ── Layer renderer ─────────────────────────────────────────────────────────────

/**
 * Renders a single avatar layer.
 *
 * Skin tone is rendered as a plain background View (no border radius) behind the
 * face image.  The face SVGs use an SVG even-odd mask — a black filled rectangle
 * covers the full viewBox, punched out by the face path — so the skin View shows
 * through *only* inside the face outline, with zero bleed outside.  This works for
 * any arbitrary face shape without runtime masking.
 */
function renderLayer(layer: AvatarLayer, layoutMap: Partial<Record<string, PartLayout>>) {
  const { key, sourceUrl, color } = layer;
  const layout = layoutMap[key] ?? { top: '0%', left: '0%', width: '100%', height: '100%' };

  if (color) {
    if (key === 'skin') {
      // Plain rectangle — the SVG exterior mask prevents it from showing outside the face outline
      return <View key={key} style={{ position: 'absolute', ...layout, backgroundColor: color }} />;
    }
    return <View key={key} style={{ position: 'absolute', ...layout, borderRadius: 999, backgroundColor: color }} />;
  }

  if (!sourceUrl) return null;
  const source = resolveAvatarSource(sourceUrl);
  if (!source) return null;

  return <Image key={key} source={source} style={{ position: 'absolute', ...layout }} contentFit="contain" />;
}

// ── Core renderer ──────────────────────────────────────────────────────────────

function AvatarLayersView({ layers, size }: { layers: AvatarLayer[]; size: number }) {
  const w = Math.round(size * (2 / 3));

  const bodyLayers    = layers.filter(l => !FACE_FEATURE_KEYS.has(l.key) && !HAIR_KEYS.has(l.key) && !TOP_OVERLAY_KEYS.has(l.key));
  const faceLayers    = layers.filter(l => FACE_FEATURE_KEYS.has(l.key));
  const hairLayers    = layers.filter(l => HAIR_KEYS.has(l.key));
  const topLayers     = layers.filter(l => TOP_OVERLAY_KEYS.has(l.key));

  return (
    <View style={{ width: w, height: size }}>
      {/* Pass 1 — body: skin, face, bottoms, tops, footwear, wristwear */}
      {bodyLayers.map(l => renderLayer(l, LAYER_LAYOUT))}

      {/* Pass 2 — face features nested inside a face-sized container.
          Positions in FACE_FEATURE_LAYOUT are relative to this box, not the character. */}
      <View style={{ position: 'absolute', ...FACE_BOUNDS, overflow: 'visible' }}>
        {faceLayers.map(l => renderLayer(l, FACE_FEATURE_LAYOUT))}
      </View>

      {/* Pass 3 — hair: hair, headwear (above face features) */}
      {hairLayers.map(l => renderLayer(l, LAYER_LAYOUT))}

      {/* Pass 4 — top overlays: facewear (glasses/masks sit above hair) */}
      {topLayers.map(l => renderLayer(l, LAYER_LAYOUT))}
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
  const endpoint = avatarId
    ? `/api/v1/users/${userId}/avatar/${avatarId}`
    : `/api/v1/users/${userId}/avatar`;

  const { data: layers } = useQuery({
    queryKey: ['userAvatar', userId, avatarId],
    queryFn: () => api.get<Avatar>(endpoint).then(avatarToLayers),
    enabled: !!userId,
  });

  if (!layers) return <Skeleton size={size} />;
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
