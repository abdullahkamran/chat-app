import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import UserAvatar from '@/components/UserAvatar';
import { AppText, Skeleton } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { ROOM_PEOPLE_PREVIEW } from '@chat-app/shared-types';

const useStyles = makeStyles(t => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: t.space.lg,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.md,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  text: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
  },
  skeletonCard: {
    borderColor: t.colors.surface,
  },
  cluster: {
    width: BADGE,
    height: BADGE,
  },
  clusterFace: {
    position: 'absolute',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: {
    flexShrink: 1,
  },
  liveDot: {
    width: t.space.sm,
    height: t.space.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.success,
  },
}));

/** The badge's side: one tile, or the box a cluster of faces sits in. */
const BADGE = 48;
/** Where each face of a cluster sits in the badge box, and how big, by how many there are. */
const CLUSTERS: Record<2 | 3 | 4, { size: number; at: { left: number; top: number }[] }> = {
  2: { size: 31, at: [{ left: 0, top: 0 }, { left: 17, top: 17 }] },
  3: { size: 27, at: [{ left: 10.5, top: 0 }, { left: 0, top: 21 }, { left: 21, top: 21 }] },
  4: { size: 25, at: [{ left: 0, top: 0 }, { left: 23, top: 0 }, { left: 0, top: 23 }, { left: 23, top: 23 }] },
};

/** Someone whose avatar's head goes on a room's badge. */
export interface RoomFace {
  userId: string;
  username: string;
}

function Face({ face, label, size, shape }: Readonly<{ face: RoomFace; label: string; size: number; shape: 'circle' | 'tile' }>) {
  const { avatar, isLoading } = useUserAvatar(face.userId);
  return <UserAvatar username={label} size={size} shape={shape} avatar={avatar} avatarLoading={isLoading} />;
}

/**
 * A room's badge: one person's head on a tile (a personal room's owner), or two to four
 * heads clustered (a group room's latest chatters). With nobody to show, the room's initial.
 */
function RoomBadge({ name, faces }: Readonly<{ name: string; faces: RoomFace[] }>) {
  const styles = useStyles();
  if (faces.length === 0) return <UserAvatar username={name} size={BADGE} shape="tile" />;
  if (faces.length === 1) return <Face face={faces[0]} label={name} size={BADGE} shape="tile" />;
  const shown = faces.slice(0, ROOM_PEOPLE_PREVIEW);
  const { size, at } = CLUSTERS[shown.length as 2 | 3 | 4];
  return (
    <View style={styles.cluster}>
      {shown.map((face, i) => (
        <View key={face.userId} style={[styles.clusterFace, at[i]]}>
          <Face face={face} label={face.username} size={size} shape="circle" />
        </View>
      ))}
    </View>
  );
}

const RoomListItem = ({
  name,
  faces,
  subtitle,
  live,
  isPersonal,
  onPress,
}: {
  name: string;
  /** Whose avatars' heads make the room's badge: one for a tile, two to four for a cluster. */
  faces?: RoomFace[];
  subtitle?: string;
  /** People are in the room now and the subtitle names them: it gets a green dot. */
  live?: boolean;
  /** Someone's personal room: marked with a house. */
  isPersonal?: boolean;
  onPress?: () => void;
}) => {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed ? { transform: [{ translateY: t.pressDepth }] } : t.shadows.sticker,
      ]}
      onPress={onPress}
    >
      <RoomBadge name={name} faces={faces ?? []} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          {isPersonal && <Ionicons name="home" size={14} color={t.colors.primary} />}
          <AppText variant="heading" style={styles.name} numberOfLines={1}>{name}</AppText>
        </View>
        {subtitle ? (
          <View style={styles.subtitleRow}>
            {live && <View style={styles.liveDot} />}
            <AppText variant="caption" color={live ? 'success' : 'textSecondary'} style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </AppText>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
    </Pressable>
  );
};

/** A RoomListItem-shaped placeholder while rooms load. */
export function RoomListItemSkeleton() {
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <Skeleton width={BADGE} height={BADGE} radius="md" />
      <View style={styles.text}>
        <Skeleton width="60%" height={16} radius="xs" />
        <Skeleton width="35%" height={10} radius="xs" />
      </View>
    </View>
  );
}

export default RoomListItem;
