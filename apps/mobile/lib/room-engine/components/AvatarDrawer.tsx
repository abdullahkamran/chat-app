import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import UserCharacter from '@/components/ui/UserCharacter';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth.context';
import { useMyAvatars, useWearAvatar } from '@/hooks/useMyAvatars';
import { type Avatar } from '@chat-app/shared-types';

const NEW_AVATAR = 'new';

interface Props {
  onClose: () => void;
}

/**
 * Bottom drawer for changing avatar without leaving the room. Tapping an avatar wears it;
 * Edit and New open the editor over the room, which stays mounted, so the user stays present
 * and everyone in the room sees the change.
 */
export function AvatarDrawer({ onClose }: Readonly<Props>) {
  const router = useRouter();
  const { selectedAvatar } = useAuth();
  const { data, isLoading } = useMyAvatars();
  const wear = useWearAvatar();

  const wornId = selectedAvatar?._id ?? data?.selectedAvatar ?? null;
  const cards: (Avatar | typeof NEW_AVATAR)[] = [...(data?.avatars ?? []), NEW_AVATAR];

  return (
    <View style={styles.drawer}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Avatars</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Close avatars">
          <Ionicons name="close" size={18} color={theme.colors.icon} />
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={theme.colors.primary} />}

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
                <Ionicons name="add" size={28} color={theme.colors.primary} />
                <Text style={styles.cardLabel}>New</Text>
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
                <UserCharacter avatar={card} size={60} />
                {isWearing && (
                  <View style={styles.wearing}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/(avatar)/edit/${card._id}`)} hitSlop={6}>
                <Text style={styles.editLabel}>Edit</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  list: {
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: 72,
    alignItems: 'center',
    borderRadius: 8,
    padding: 6,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardWorn: {
    borderColor: theme.colors.primary,
  },
  newCard: {
    justifyContent: 'center',
    borderColor: theme.colors.borderSubtle,
    borderStyle: 'dashed',
  },
  preview: {
    position: 'relative',
  },
  wearing: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    borderRadius: 6,
  },
  cardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  editLabel: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
