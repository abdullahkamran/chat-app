import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import AvatarPreview from '@/components/AvatarPreview';
import { AppText, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useAuth } from '@/context/auth.context';
import { useMyAvatars, useWearAvatar } from '@/hooks/useMyAvatars';
import { type Avatar } from '@chat-app/shared-types';
import { Drawer } from './Drawer';

const NEW_AVATAR = 'new';

const useStyles = makeStyles(t => ({
  list: {
    gap: t.space.sm + 2,
    paddingBottom: t.space.xs,
  },
  card: {
    width: 76,
    alignItems: 'center',
    borderRadius: t.radius.md,
    padding: 6,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
  },
  cardWorn: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
  },
  newCard: {
    justifyContent: 'center',
    gap: t.space.xs,
    borderColor: t.colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  preview: {
    position: 'relative',
  },
  wearing: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.overlay,
    borderRadius: t.radius.sm,
  },
  editLabel: {
    marginTop: t.space.xs,
  },
}));

interface Props {
  onClose: () => void;
}

/**
 * Bottom drawer for changing avatar without leaving the room. Tapping an avatar wears it;
 * Edit and New open the editor over the room, which stays mounted, so the user stays present
 * and everyone in the room sees the change.
 */
export function AvatarDrawer({ onClose }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { selectedAvatar } = useAuth();
  const { data, isLoading } = useMyAvatars();
  const wear = useWearAvatar();

  const wornId = selectedAvatar?._id ?? data?.selectedAvatar ?? null;
  const cards: (Avatar | typeof NEW_AVATAR)[] = [...(data?.avatars ?? []), NEW_AVATAR];

  return (
    <Drawer title="Avatars" onClose={onClose}>
      {isLoading && <Spinner />}

      <FlatList
        data={cards}
        keyExtractor={card => (card === NEW_AVATAR ? NEW_AVATAR : card._id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: card }) => {
          if (card === NEW_AVATAR) {
            return (
              <TouchableOpacity style={[styles.card, styles.newCard]} onPress={() => router.push('/(avatar)/create')}>
                <Ionicons name="add-circle" size={30} color={t.colors.primary} />
                <AppText variant="caption" color="textSecondary">New</AppText>
              </TouchableOpacity>
            );
          }
          const isWorn = card._id === wornId;
          const isWearing = wear.isPending && wear.variables?._id === card._id;
          return (
            <View style={[styles.card, isWorn && styles.cardWorn]}>
              <TouchableOpacity
                style={styles.preview}
                onPress={() => !isWorn && !wear.isPending && wear.mutate(card)}
                activeOpacity={isWorn ? 1 : 0.8}
                accessibilityLabel={isWorn ? 'Current avatar' : 'Wear this avatar'}
              >
                <AvatarPreview avatar={card} size={60} animated={false} />
                {isWearing && (
                  <View style={styles.wearing}>
                    <Spinner size="small" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/(avatar)/edit/${card._id}`)} hitSlop={6}>
                <AppText variant="label" color="primary" style={styles.editLabel}>Edit</AppText>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </Drawer>
  );
}
