import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { FlatList, Pressable } from 'react-native';

import { AppText, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { AnimationCategory, type Animation } from '@chat-app/shared-types';
import { Drawer } from './Drawer';

type IconName = ComponentProps<typeof Ionicons>['name'];

const EMOTE_ICONS: Record<string, IconName> = {
  wave: 'hand-left-outline',
  clap: 'hand-right-outline',
  laugh: 'happy-outline',
  dance: 'musical-notes-outline',
  thumbsUp: 'thumbs-up-outline',
  shrug: 'help-outline',
  facepalm: 'sad-outline',
  cheer: 'trophy-outline',
  bow: 'ribbon-outline',
  cry: 'water-outline',
  jump: 'arrow-up-circle-outline',
  point: 'arrow-forward-outline',
  flex: 'barbell-outline',
  blowKiss: 'heart-outline',
};

/** Animation names are camelCase ids: `blowKiss` → `blow kiss`. */
function emoteLabel(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

const useStyles = makeStyles(t => ({
  list: {
    gap: t.space.sm + 2,
    paddingBottom: t.space.xs,
  },
  tile: {
    width: 76,
    alignItems: 'center',
    gap: t.space.xs,
    borderRadius: t.radius.md,
    paddingVertical: t.space.md,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
  },
  tileDisabled: {
    opacity: 0.4,
  },
  label: {
    textTransform: 'capitalize',
  },
}));

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
  const t = useTheme();
  const styles = useStyles();
  const { data: owned = [], isLoading } = useQuery<Animation[]>({
    queryKey: ['animation-inventory'],
    queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
  });
  const emotes = owned.filter(a => a.category === AnimationCategory.EMOTE);

  return (
    <Drawer
      title="Emotes"
      onClose={onClose}
      footer={disabled ? 'Stand up to use emotes.' : 'Get more emotes in the Shop, under Animations.'}
    >
      {isLoading && <Spinner />}

      <FlatList
        data={emotes}
        keyExtractor={emote => emote._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: emote }) => (
          <Pressable
            style={({ pressed }) => [
              styles.tile,
              !disabled && !pressed && t.shadows.sticker,
              !disabled && pressed && { transform: [{ translateY: t.pressDepth }] },
              disabled && styles.tileDisabled,
            ]}
            onPress={() => !disabled && onEmote(emote.name)}
            accessibilityLabel={`Play ${emote.name}`}
          >
            <Ionicons name={EMOTE_ICONS[emote.name] ?? 'sparkles-outline'} size={24} color={t.colors.primary} />
            <AppText variant="caption" style={styles.label} numberOfLines={1}>{emoteLabel(emote.name)}</AppText>
          </Pressable>
        )}
      />
    </Drawer>
  );
}
