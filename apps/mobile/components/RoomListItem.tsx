import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import UserAvatar from '@/components/UserAvatar';
import { AppText } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';

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
}));

const RoomListItem = ({
  name,
  subtitle,
  isPersonal,
  onPress,
}: {
  name: string;
  subtitle?: string;
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
      <UserAvatar username={name} size={48} shape="tile" />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          {isPersonal && <Ionicons name="home" size={14} color={t.colors.primary} />}
          <AppText variant="heading" style={styles.name} numberOfLines={1}>{name}</AppText>
        </View>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
    </Pressable>
  );
};

export default RoomListItem;
