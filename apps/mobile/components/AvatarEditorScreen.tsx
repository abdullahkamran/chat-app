import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AVATAR_NAME_MAX_LENGTH, Avatar, AvatarInventoryEntry, AvatarItem, AvatarItemVariant, WearableAsset } from '@chat-app/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth.context';
import { MY_AVATARS_KEY, type MyAvatars } from '@/hooks/useMyAvatars';
import { announceAvatarChanged } from '@/utils/socketUtils';
import { makeStyles, useTheme } from '@/constants/theme';
import { AppText, Button, Chip, EmptyState, Spinner, TextField } from '@/components/ui';
import { resolveAvatarSource } from '@/constants/avatarAssets';
import AvatarPreview from '@/components/AvatarPreview';
import type { AvatarOutfit } from '@/lib/room-engine/engines/skia/wearables/useAvatarArts';

// ── Types ──────────────────────────────────────────────────────────────────────

const PART_CATEGORIES = [
  { key: 'face',       label: 'Face',        required: true  },
  { key: 'eye',        label: 'Eyes',        required: true  },
  { key: 'mouth',      label: 'Mouth',       required: true  },
  { key: 'tops',       label: 'Tops',        required: true  },
  { key: 'bottoms',    label: 'Bottoms',     required: true  },
  { key: 'nose',       label: 'Nose',        required: true  },
  { key: 'skin',       label: 'Skin',        required: true  },
  { key: 'hair',       label: 'Hair',        required: false },
  { key: 'facialHair', label: 'Facial Hair', required: false },
  { key: 'headwear',   label: 'Headwear',    required: false },
  { key: 'facewear',   label: 'Facewear',    required: false },
  { key: 'wristwear',  label: 'Wrist',       required: false },
  { key: 'neckwear',   label: 'Neck',        required: false },
  { key: 'footwear',   label: 'Shoes',       required: false },
] as const;

type AvatarPartKey = (typeof PART_CATEGORIES)[number]['key'];

type AvatarSelections = Partial<Record<AvatarPartKey, { itemId: string; variantId: string }>>;

/** What create and edit send: the picked parts, plus the name (blank clears it). */
type AvatarBody = AvatarSelections & { name: string };

/** What the live preview needs of each chosen variant: its rig art and colour. */
type PreviewVariant = Pick<AvatarItemVariant, 'color' | 'rigAsset'>;
type PreviewVariants = Partial<Record<AvatarPartKey, PreviewVariant>>;

interface Props {
  mode: 'create' | 'edit';
  avatarId?: string;
  initialSelections?: AvatarSelections;
  /** Pass the full Avatar object in edit mode to seed the live preview immediately. */
  initialAvatar?: Avatar;
  onSaved: (avatar: Avatar) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const REQUIRED_PARTS = PART_CATEGORIES.filter((c) => c.required).map((c) => c.key);

function isComplete(selections: AvatarSelections): boolean {
  return REQUIRED_PARTS.every((k) => !!selections[k]);
}

/** Extract selections + each part's selected variant (for the preview) from a fully-populated Avatar object. */
function deriveFromAvatar(avatar: Avatar): {
  selections: AvatarSelections;
  variants: PreviewVariants;
} {
  const selections: AvatarSelections = {};
  const variants: PreviewVariants = {};

  for (const { key } of PART_CATEGORIES) {
    const item = avatar[key] as AvatarItem | undefined;
    const variant = item?.variants?.[0];
    if (!item?._id || !variant) continue;
    selections[key] = { itemId: item._id, variantId: variant._id };
    variants[key] = variant;
  }

  return { selections, variants };
}

/** The working outfit in the shape the Skia preview composes: each part's chosen variant first. */
function toOutfit(variants: PreviewVariants): AvatarOutfit {
  const outfit: AvatarOutfit = {};
  for (const [key, variant] of Object.entries(variants) as [AvatarPartKey, PreviewVariant | undefined][]) {
    if (variant) outfit[key] = { variants: [variant] };
  }
  return outfit;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvatarEditorScreen({ mode, avatarId, initialSelections, initialAvatar, onSaved }: Props) {
  const { selectedAvatar, setSelectedAvatar } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useStyles();

  const derived = initialAvatar ? deriveFromAvatar(initialAvatar) : null;

  const [name, setName] = useState(initialAvatar?.name ?? '');
  const [activeCategory, setActiveCategory] = useState<AvatarPartKey>('skin');
  const [selections, setSelections] = useState<AvatarSelections>(derived?.selections ?? initialSelections ?? {});
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  // Each part's chosen variant (rig art + colour), so unsaved picks show in the preview at once.
  const [previewVariants, setPreviewVariants] = useState<PreviewVariants>(derived?.variants ?? {});
  const previewOutfit = useMemo(() => toOutfit(previewVariants), [previewVariants]);

  // Pre-populate defaults when opening the create editor
  useEffect(() => {
    if (mode !== 'create') return;
    api
      .get<Record<string, {
        itemId: string;
        variantId: string;
        sourceUrl: string | null;
        color: string | null;
        rigAsset?: WearableAsset | null;
      }>>('/api/v1/avatar/defaults')
      .then((defaults) => {
        const sel: AvatarSelections = {};
        const variants: PreviewVariants = {};
        for (const [cat, d] of Object.entries(defaults)) {
          sel[cat as AvatarPartKey] = { itemId: d.itemId, variantId: d.variantId };
          variants[cat as AvatarPartKey] = { color: d.color ?? undefined, rigAsset: d.rigAsset ?? undefined };
        }
        setSelections(sel);
        setPreviewVariants(variants);
      })
      .catch(() => {});
  }, [mode]);

  // Fetch catalog items for the active category tab
  const { data: catalogItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['avatar-items', activeCategory],
    queryFn: () => api.get<AvatarItem[]>(`/api/v1/avatar/items?category=${activeCategory}`),
  });

  // Fetch owned avatar item variants to gate the editor
  const { data: avatarInventory = [] } = useQuery<AvatarInventoryEntry[]>({
    queryKey: ['avatar-inventory'],
    queryFn: () => api.get<AvatarInventoryEntry[]>('/api/v1/inventory/avatar'),
  });

  // Profile, the edit screen and the room's avatar drawer list the user's avatars. The saved
  // avatar goes into the cached list first, so the screen we go back to shows it at once
  // instead of after the refetch (which populates every avatar and takes a few seconds).
  function refreshAvatarLists(saved: Avatar) {
    queryClient.setQueryData<MyAvatars>(MY_AVATARS_KEY, (old) => {
      if (!old) return old;
      const exists = old.avatars.some((a) => a._id === saved._id);
      return {
        ...old,
        avatars: exists ? old.avatars.map((a) => (a._id === saved._id ? saved : a)) : [...old.avatars, saved],
        selectedAvatar: old.selectedAvatar ?? saved._id,
      };
    });
    queryClient.invalidateQueries({ queryKey: MY_AVATARS_KEY });
  }

  const createMutation = useMutation({
    mutationFn: (body: AvatarBody) => api.post<Avatar>('/api/v1/avatar', body),
    onSuccess: (avatar) => {
      // The backend only selects a new avatar when it is the user's first.
      if (!selectedAvatar) {
        setSelectedAvatar(avatar);
        announceAvatarChanged();
      }
      refreshAvatarLists(avatar);
      onSaved(avatar);
    },
  });

  const editMutation = useMutation({
    mutationFn: (body: AvatarBody) => api.put<Avatar>(`/api/v1/avatar/${avatarId}`, body),
    onSuccess: (avatar) => {
      if (selectedAvatar?._id === avatar._id) {
        setSelectedAvatar(avatar);
        announceAvatarChanged();
      }
      refreshAvatarLists(avatar);
      onSaved(avatar);
    },
  });

  const isSaving = createMutation.isPending || editMutation.isPending;

  function handleSelectItem(item: AvatarItem) {
    setActiveItemId(item._id);
    // Auto-select the first variant if only one exists
    if (item.variants.length === 1) {
      selectVariant(item._id, item.variants[0]._id);
    }
  }

  function selectVariant(itemId: string, variantId: string) {
    setSelections((prev) => ({ ...prev, [activeCategory]: { itemId, variantId } }));
    const variant = catalogItems
      .find((i) => i._id === itemId)
      ?.variants.find((v) => v._id === variantId);
    if (variant) setPreviewVariants((prev) => ({ ...prev, [activeCategory]: variant }));
  }

  function handleSave() {
    // Build payload: { eye: { itemId, variantId }, skin: { itemId, variantId }, ... }
    const payload: Record<string, { itemId: string; variantId: string }> = {};
    for (const [key, val] of Object.entries(selections)) {
      if (val) payload[key] = val;
    }
    const body: AvatarBody = { ...(payload as AvatarSelections), name: name.trim() };
    if (mode === 'create') {
      createMutation.mutate(body);
    } else {
      editMutation.mutate(body);
    }
  }

  const activeItemForCategory = catalogItems.find(
    (item) => item._id === (selections[activeCategory]?.itemId ?? null)
  );

  // Build a set of owned variantIds for quick lookup
  const ownedVariantIds = new Set(avatarInventory.map((e) => e.variantId));

  // Only show items that have at least one owned variant
  const availableItems = catalogItems.filter((item) =>
    item.variants.some((v) => ownedVariantIds.has(v._id))
  );

  const isOptionalCategory = PART_CATEGORIES.find((c) => c.key === activeCategory)?.required === false;

  function handleClearSelection() {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[activeCategory];
      return next;
    });
    setPreviewVariants((prev) => {
      const next = { ...prev };
      delete next[activeCategory];
      return next;
    });
    setActiveItemId(null);
  }

  const errorMessage =
    (createMutation.error as Error | null)?.message ??
    (editMutation.error as Error | null)?.message ?? null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* ── Preview ── */}
      <View style={styles.preview}>
        <View style={styles.spotlight} />
        <AvatarPreview avatar={previewOutfit} size={220} rotatable />
      </View>

      {/* ── Name ── */}
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Name your avatar (optional)"
        maxLength={AVATAR_NAME_MAX_LENGTH}
        leftIcon="pricetag-outline"
        returnKeyType="done"
        autoCapitalize="words"
        accessibilityLabel="Avatar name"
        containerStyle={styles.nameField}
      />

      {/* ── Category tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {PART_CATEGORIES.map((cat) => {
          const hasPick = !!selections[cat.key];
          return (
            <Chip
              key={cat.key}
              label={!hasPick && cat.required ? `${cat.label} *` : cat.label}
              trailingIcon={hasPick ? 'checkmark-circle' : undefined}
              selected={activeCategory === cat.key}
              onPress={() => {
                setActiveCategory(cat.key);
                setActiveItemId(null);
              }}
            />
          );
        })}
      </ScrollView>

      {/* ── Items grid ── */}
      {loadingItems ? (
        <Spinner style={styles.gridLoader} />
      ) : (
        <FlatList
          key={activeCategory}
          data={availableItems}
          keyExtractor={(item) => item._id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={isOptionalCategory ? (
            <View style={styles.noneRow}>
              <Pressable
                style={[styles.gridItem, styles.noneItem, !selections[activeCategory] && styles.gridItemChosen]}
                onPress={handleClearSelection}
              >
                <View style={[styles.gridItemSwatch, styles.noneItemSwatch]}>
                  <Ionicons name="close" size={22} color={t.colors.textMuted} />
                </View>
                <AppText variant="caption" color="textSubtle" align="center">None</AppText>
              </Pressable>
            </View>
          ) : undefined}
          renderItem={({ item }) => {
            const isChosen = selections[activeCategory]?.itemId === item._id;
            const source = resolveAvatarSource(item.variants[0]?.sourceUrl ?? '');
            const fallbackColor = item.variants[0]?.color ?? t.colors.border;
            return (
              <Pressable
                style={[styles.gridItem, isChosen && styles.gridItemChosen]}
                onPress={() => handleSelectItem(item)}
              >
                {source
                  ? <Image source={source} style={styles.gridItemSwatch} contentFit="contain" />
                  : <View style={[styles.gridItemSwatch, styles.colorSwatch, { backgroundColor: fallbackColor }]} />
                }
                <AppText variant="caption" color="textSubtle" align="center" numberOfLines={1}>
                  {item.name}
                </AppText>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState icon="bag-handle-outline" title="Nothing here yet" body="Visit the Shop to pick some up!" />
          }
        />
      )}

      {/* ── Variant picker ── */}
      {activeItemId && (
        <View style={styles.variantRow}>
          <AppText variant="overline" color="textMuted" style={styles.variantLabel}>Choose colour / style</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantContent}>
            {(catalogItems.find((i) => i._id === activeItemId)?.variants ?? [])
              .filter((v) => ownedVariantIds.has(v._id))
              .map((variant) => {
              const isChosen = selections[activeCategory]?.variantId === variant._id;
              return (
                <Pressable
                  key={variant._id}
                  style={[styles.variantSwatch, isChosen && styles.variantSwatchChosen]}
                  onPress={() => selectVariant(activeItemId, variant._id)}
                >
                  <View
                    style={[
                      styles.variantSwatchColor,
                      { backgroundColor: variant.color ?? t.colors.textMuted },
                    ]}
                  />
                  <AppText variant="caption" color="placeholder" align="center" style={styles.variantSwatchName} numberOfLines={1}>
                    {variant.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Error ── */}
      {errorMessage && <AppText variant="label" color="error" align="center" style={styles.error}>{errorMessage}</AppText>}

      {/* ── Save button ── */}
      <Button
        title={mode === 'create' ? 'Create Avatar' : 'Save Changes'}
        size="lg"
        loading={isSaving}
        disabled={!isComplete(selections)}
        onPress={handleSave}
        style={styles.saveButton}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  preview: {
    marginHorizontal: t.space.lg,
    marginTop: t.space.sm,
    borderRadius: t.radius.xl,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 248,
    paddingBottom: t.space.md,
    overflow: 'hidden',
  },
  // A soft floor disc under the avatar's feet.
  spotlight: {
    position: 'absolute',
    bottom: t.space.md - 4,
    width: 150,
    height: 34,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primarySoft,
  },
  nameField: {
    marginHorizontal: t.space.lg,
    marginTop: t.space.md,
  },
  tabBar: {
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    gap: t.space.sm,
  },
  gridLoader: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: t.space.md,
    paddingBottom: t.space.md,
  },
  gridItem: {
    flex: 1,
    margin: t.space.xs,
    alignItems: 'center',
    padding: 10,
    gap: 6,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
  },
  gridItemChosen: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
  },
  gridItemSwatch: {
    width: 48,
    height: 48,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
  },
  noneRow: {
    flexDirection: 'row',
  },
  noneItem: {
    flex: 0,
    width: '30%',
  },
  noneItemSwatch: {
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.borderStrong,
    borderStyle: 'dashed',
  },
  variantRow: {
    borderTopWidth: t.borderWidth.thin,
    borderTopColor: t.colors.border,
    paddingVertical: t.space.md,
  },
  variantLabel: {
    marginBottom: t.space.sm,
    paddingHorizontal: t.space.lg,
  },
  variantContent: {
    paddingHorizontal: t.space.md,
    gap: t.space.xs,
  },
  variantSwatch: {
    alignItems: 'center',
    padding: 6,
    gap: t.space.xs,
    borderRadius: t.radius.md,
    borderWidth: t.borderWidth.thick,
    borderColor: 'transparent',
  },
  variantSwatchChosen: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
  },
  variantSwatchColor: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
  },
  variantSwatchName: {
    maxWidth: 54,
  },
  error: {
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.sm,
  },
  saveButton: {
    margin: t.space.lg,
    marginTop: t.space.sm,
  },
}));
