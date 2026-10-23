import { Ionicons } from '@expo/vector-icons';
import { Canvas, Picture } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Facing } from '@chat-app/shared-types';
import { useAvatarPreviewPicture } from '@/lib/room-engine/engines/skia/useAvatarPreviewPicture';
import {
  PLACEHOLDER_ART,
  useOutfitArts,
  type AvatarOutfit,
} from '@/lib/room-engine/engines/skia/wearables/useAvatarArts';

/** Turn order for the rotate button: front right, front left, back left, back right. */
const FACINGS = [Facing.SE, Facing.SW, Facing.NW, Facing.NE] as const;
const PREVIEW_ID = 'preview';
/** Rig content pixels shown top to bottom: the 80 px avatar plus headroom for hats and the idle bob. */
const CONTENT_HEIGHT = 100;
/** Feet sit this far up from the bottom edge, in content pixels. */
const FEET_MARGIN = 6;

interface Props {
  /** The outfit to draw; changes show as soon as they compose. Null draws the placeholder. */
  avatar: AvatarOutfit | null | undefined;
  /** Canvas height in px; the width is 3/4 of it. */
  size?: number;
  /** Show a button that turns the avatar through the four facings. */
  rotatable?: boolean;
  /** Play the idle animation. Pass false for lists of cards: each animated preview runs its own frame loop. */
  animated?: boolean;
}

/**
 * The Skia rigged avatar exactly as rooms draw it, idling, for screens outside rooms.
 * Shows the programmer-art placeholder until the outfit's atlases are composed.
 */
export default function AvatarPreview({ avatar, size = 220, rotatable = false, animated = true }: Props) {
  const [facingIndex, setFacingIndex] = useState(0);
  const outfits = useMemo(() => ({ [PREVIEW_ID]: avatar }), [avatar]);
  const { arts, artKeys } = useOutfitArts(outfits);
  const art = arts[artKeys[PREVIEW_ID]] ?? arts[PLACEHOLDER_ART];

  const width = Math.round(size * 0.75);
  const scale = size / CONTENT_HEIGHT;
  const picture = useAvatarPreviewPicture({
    art,
    facing: FACINGS[facingIndex],
    feetX: width / 2,
    feetY: size - FEET_MARGIN * scale,
    scale,
    animated,
  });

  return (
    <View style={{ width, height: size }}>
      <Canvas style={{ width, height: size }}>
        <Picture picture={picture} />
      </Canvas>
      {rotatable && (
        <Pressable
          style={styles.rotate}
          onPress={() => setFacingIndex(i => (i + 1) % FACINGS.length)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Turn avatar"
        >
          <Ionicons name="sync" size={18} color={theme.colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rotate: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
});
