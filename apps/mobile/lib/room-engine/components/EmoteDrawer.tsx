import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { AnimationCategory, EmoteType, type Animation } from '@chat-app/shared-types';
import { Drawer } from './Drawer';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const EMOTE_ICONS: Record<string, IconName> = {
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
  moonwalk: 'moon-outline',
  highFive: 'flash-outline',
  hug: 'heart-circle-outline',
  throwTomato: 'nutrition-outline',
  throwSnowball: 'snow-outline',
};

/** The corner mark on two-person emotes. */
const TYPE_ICONS: Partial<Record<EmoteType, IconName>> = {
  [EmoteType.MUTUAL]: 'people',
  [EmoteType.INTERACTIVE]: 'locate',
};

/** Solo emotes first, then the ones done with someone. */
const TYPE_ORDER: Record<EmoteType, number> = { solo: 0, mutual: 1, interactive: 2 };

/** Animation names are camelCase ids: `blowKiss` → `blow kiss`. */
export function emoteLabel(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

export function emoteTypeOf(emote: Pick<Animation, 'emoteType'>): EmoteType {
  return emote.emoteType ?? EmoteType.SOLO;
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
  typeMark: {
    position: 'absolute',
    top: t.space.xxs,
    right: t.space.xxs,
    width: 20,
    height: 20,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.secondarySoft,
  },
  label: {
    textTransform: 'capitalize',
  },
}));

interface Props {
  onEmote: (emote: Animation) => void;
  onClose: () => void;
}

/**
 * Bottom drawer listing the emotes the user owns. A solo emote plays for everyone in the
 * room at once (a seated user stands up first); a two-person one (marked in the corner)
 * then asks the user to tap someone. Shares the Shop's ['animation-inventory'] query, so a
 * purchase shows up here.
 */
export function EmoteDrawer({ onEmote, onClose }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  const { data: owned = [], isLoading } = useQuery<Animation[]>({
    queryKey: ['animation-inventory'],
    queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
  });
  const emotes = owned
    .filter(a => a.category === AnimationCategory.EMOTE)
    .sort((a, b) => TYPE_ORDER[emoteTypeOf(a)] - TYPE_ORDER[emoteTypeOf(b)]);

  return (
    <Drawer title="Emotes" onClose={onClose} footer="Get more emotes in the Shop, under Animations.">
      {isLoading && <Spinner />}

      <FlatList
        data={emotes}
        keyExtractor={emote => emote._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: emote }) => {
          const typeIcon = TYPE_ICONS[emoteTypeOf(emote)];
          return (
            <Pressable
              style={({ pressed }) => [
                styles.tile,
                !pressed && t.shadows.sticker,
                pressed && { transform: [{ translateY: t.pressDepth }] },
              ]}
              onPress={() => onEmote(emote)}
              accessibilityLabel={`Play ${emoteLabel(emote.name)}`}
            >
              <Ionicons name={EMOTE_ICONS[emote.name] ?? 'sparkles-outline'} size={24} color={t.colors.primary} />
              <AppText variant="caption" style={styles.label} numberOfLines={1}>{emoteLabel(emote.name)}</AppText>
              {typeIcon && (
                <View style={styles.typeMark}>
                  <Ionicons name={typeIcon} size={12} color={t.colors.secondary} />
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </Drawer>
  );
}
