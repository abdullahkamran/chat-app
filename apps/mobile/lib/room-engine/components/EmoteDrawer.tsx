import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '@/constants/theme';
import { api } from '@/lib/api';
import { AnimationCategory, type Animation } from '@chat-app/shared-types';

type IconName = ComponentProps<typeof Ionicons>['name'];

const EMOTE_ICONS: Record<string, IconName> = {
  wave: 'hand-left-outline',
  clap: 'hand-right-outline',
  laugh: 'happy-outline',
  dance: 'musical-notes-outline',
};

interface Props {
  /** Seated users can't emote; the drawer explains instead. */
  disabled: boolean;
  onEmote: (name: string) => void;
  onClose: () => void;
}

/**
 * Bottom drawer listing the emotes the user owns. Tapping one plays it for everyone in
 * the room. Shares the Shop's ['animation-inventory'] query, so a purchase shows up here.
 */
export function EmoteDrawer({ disabled, onEmote, onClose }: Readonly<Props>) {
  const { data: owned = [], isLoading } = useQuery<Animation[]>({
    queryKey: ['animation-inventory'],
    queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
  });
  const emotes = owned.filter(a => a.category === AnimationCategory.EMOTE);

  return (
    <View style={styles.drawer}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Emotes</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Close emotes">
          <Ionicons name="close" size={18} color={theme.colors.icon} />
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={theme.colors.primary} />}

      <FlatList
        data={emotes}
        keyExtractor={emote => emote._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: emote }) => (
          <TouchableOpacity
            style={[styles.chip, disabled && styles.chipDisabled]}
            onPress={() => !disabled && onEmote(emote.name)}
            activeOpacity={disabled ? 1 : 0.8}
            accessibilityLabel={`Play ${emote.name}`}
          >
            <Ionicons name={EMOTE_ICONS[emote.name] ?? 'sparkles-outline'} size={22} color={theme.colors.primary} />
            <Text style={styles.chipLabel}>{emote.name}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.hint}>
        {disabled ? 'Stand up to use emotes.' : 'Get more emotes in the Shop, under Animations.'}
      </Text>
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
  chip: {
    width: 72,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceElevated,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipLabel: {
    color: theme.colors.text,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
});
