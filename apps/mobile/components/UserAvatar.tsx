import { Canvas, Picture } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme, type Theme } from '@/constants/theme';
import { HEAD_FRAME } from '@/lib/room-engine/engines/skia/skeleton/humanoidV1';
import { useAvatarPreviewPicture } from '@/lib/room-engine/engines/skia/useAvatarPreviewPicture';
import {
  PLACEHOLDER_ART,
  useOutfitArts,
  type AvatarOutfit,
} from '@/lib/room-engine/engines/skia/wearables/useAvatarArts';
import { Facing } from '@chat-app/shared-types';

/** The same accent color for a name every time. */
export function avatarColor(t: Theme, name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return t.avatarPalette[Math.abs(hash) % t.avatarPalette.length];
}

const useStyles = makeStyles(t => ({
  shape: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
  },
  letter: {
    fontFamily: t.fontFamily.display,
    color: t.colors.onPrimary,
  },
}));

type Shape = 'circle' | 'tile';

interface Props {
  /** The name whose first letter is shown and whose color is used. */
  username: string;
  size?: number;
  /** A circle for people, a tilted rounded tile for rooms. */
  shape?: Shape;
  /**
   * The person's avatar. When given, the badge is a window on its head, drawn by the room's
   * own avatar renderer, over the name's color. Without one it shows the name's first letter.
   */
  avatar?: AvatarOutfit | null;
  /** The avatar is still being fetched: shows the pulsing ghost head meanwhile. */
  avatarLoading?: boolean;
}

function frameStyle(size: number, shape: Shape, backgroundColor: string) {
  return [
    { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : size * 0.32, backgroundColor },
    shape === 'tile' && { transform: [{ rotate: '-4deg' as const }] },
  ];
}

function Letter({ username, size }: Readonly<{ username: string; size: number }>) {
  const styles = useStyles();
  return (
    <Text style={[styles.letter, { fontSize: size * 0.44, lineHeight: size * 0.56 }]}>
      {username.charAt(0).toUpperCase()}
    </Text>
  );
}

const HEAD_ID = 'head';

/**
 * The avatar's head in the badge: the ghost while its outfit loads, then the head as rooms
 * draw it. Falls back to the letter if the outfit has no art or its art fails to load.
 */
function HeadBadge({ username, size, shape, avatar, avatarLoading }: Readonly<Required<Pick<Props, 'username' | 'size' | 'shape'>> & Pick<Props, 'avatar' | 'avatarLoading'>>) {
  const t = useTheme();
  const styles = useStyles();
  const outfits = useMemo(() => ({ [HEAD_ID]: avatar }), [avatar]);
  const { arts, artKeys, unavailable } = useOutfitArts(outfits);
  const art = arts[artKeys[HEAD_ID]] ?? arts[PLACEHOLDER_ART];

  // The canvas fills the badge inside its border and frames the rig's head.
  const inner = size - 2 * t.borderWidth.thick;
  const scale = inner / (2 * HEAD_FRAME.half);
  const picture = useAvatarPreviewPicture({
    art,
    facing: Facing.SE,
    feetX: inner / 2,
    feetY: inner / 2 - HEAD_FRAME.y * scale,
    scale,
    animated: false,
  });

  if (!avatarLoading && unavailable[HEAD_ID]) {
    return (
      <View style={[styles.shape, frameStyle(size, shape, avatarColor(t, username))]}>
        <Letter username={username} size={size} />
      </View>
    );
  }
  return (
    <View
      style={[styles.shape, frameStyle(size, shape, art.ghost ? t.colors.skeleton : avatarColor(t, username))]}
      accessible={art.ghost || undefined}
      accessibilityLabel={art.ghost ? 'Loading avatar' : undefined}
      accessibilityState={art.ghost ? { busy: true } : undefined}
    >
      <Canvas style={{ width: inner, height: inner }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

/**
 * A badge for a person or a room in lists: their avatar's head when `avatar` is given,
 * otherwise a colored badge with the first letter of the name.
 */
export default function UserAvatar({ username, size = 40, shape = 'circle', avatar, avatarLoading }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  if (avatar || avatarLoading) {
    return <HeadBadge username={username} size={size} shape={shape} avatar={avatar} avatarLoading={avatarLoading} />;
  }
  return (
    <View style={[styles.shape, frameStyle(size, shape, avatarColor(t, username))]}>
      <Letter username={username} size={size} />
    </View>
  );
}
