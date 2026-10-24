import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarInventoryEntry, AvatarItem, AvatarItemVariant, WearableAsset } from '@chat-app/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth.context';
import { MY_AVATARS_KEY } from '@/hooks/useMyAvatars';
import { announceAvatarChanged } from '@/utils/socketUtils';
import { theme } from '@/constants/theme';
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
  { key: 'footwear',   label: 'Shoes',       required: false },
] as const;

type AvatarPartKey = (typeof PART_CATEGORIES)[number]['key'];

type AvatarSelections = Partial<Record<AvatarPartKey, { itemId: string; variantId: string }>>;

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

  const derived = initialAvatar ? deriveFromAvatar(initialAvatar) : null;

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

  // Profile, the edit screen and the room's avatar drawer list the user's avatars.
  function refreshAvatarLists() {
    queryClient.invalidateQueries({ queryKey: MY_AVATARS_KEY });
  }

  const createMutation = useMutation({
    mutationFn: (body: AvatarSelections) => api.post<Avatar>('/api/v1/avatar', body),
    onSuccess: (avatar) => {
      // The backend only selects a new avatar when it is the user's first.
      if (!selectedAvatar) {
        setSelectedAvatar(avatar);
        announceAvatarChanged();
      }
      refreshAvatarLists();
      onSaved(avatar);
    },
  });

  const editMutation = useMutation({
    mutationFn: (body: AvatarSelections) => api.put<Avatar>(`/api/v1/avatar/${avatarId}`, body),
    onSuccess: (avatar) => {
      if (selectedAvatar?._id === avatar._id) {
        setSelectedAvatar(avatar);
        announceAvatarChanged();
      }
      refreshAvatarLists();
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
    if (mode === 'create') {
      createMutation.mutate(payload as AvatarSelections);
    } else {
      editMutation.mutate(payload as AvatarSelections);
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
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={styles.previewCharacter}>
          <AvatarPreview avatar={previewOutfit} size={220} rotatable />
        </View>
      </View>

      {/* ── Category tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {PART_CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.key;
          const hasPick = !!selections[cat.key];
          return (
            <Pressable
              key={cat.key}
              style={[styles.tab, isSelected && styles.tabActive]}
              onPress={() => {
                setActiveCategory(cat.key);
                setActiveItemId(null);
              }}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {cat.label}
                {hasPick ? ' ✓' : cat.required ? ' *' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Items grid ── */}
      {loadingItems ? (
        <ActivityIndicator style={styles.gridLoader} color={theme.colors.primary} />
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
                <View style={[styles.gridItemSwatch, styles.noneItemSwatch]} />
                <Text style={styles.gridItemName}>None</Text>
              </Pressable>
            </View>
          ) : undefined}
          renderItem={({ item }) => {
            const isChosen = selections[activeCategory]?.itemId === item._id;
            const source = resolveAvatarSource(item.variants[0]?.sourceUrl ?? '');
            const fallbackColor = item.variants[0]?.color ?? theme.colors.border;
            return (
              <Pressable
                style={[styles.gridItem, isChosen && styles.gridItemChosen]}
                onPress={() => handleSelectItem(item)}
              >
                {source
                  ? <Image source={source} style={styles.gridItemSwatch} contentFit="contain" />
                  : <View style={[styles.gridItemSwatch, { backgroundColor: fallbackColor }]} />
                }
                <Text style={styles.gridItemName} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No owned items for this category yet. Visit the Shop to buy some!</Text>
          }
        />
      )}

      {/* ── Variant picker ── */}
      {activeItemId && (
        <View style={styles.variantRow}>
          <Text style={styles.variantLabel}>Choose colour / style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                      { backgroundColor: variant.color ?? theme.colors.textMuted },
                    ]}
                  />
                  <Text style={styles.variantSwatchName} numberOfLines={1}>
                    {variant.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Error ── */}
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {/* ── Save button ── */}
      <Pressable
        style={[styles.saveButton, (!isComplete(selections) || isSaving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!isComplete(selections) || isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <Text style={styles.saveButtonText}>
            {mode === 'create' ? 'Create Avatar' : 'Save Changes'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  preview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  previewLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
  },
  previewCharacter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.colors.primaryText,
  },
  gridLoader: {
    flex: 1,
  },
  grid: {
    padding: 12,
    gap: 8,
  },
  gridItem: {
    flex: 1,
    margin: 4,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridItemChosen: {
    borderColor: theme.colors.primary,
  },
  gridItemSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  gridItemName: {
    color: theme.colors.textSubtle,
    fontSize: 11,
    textAlign: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  noneRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  noneItem: {
    flex: 0,
    width: '30%',
  },
  noneItemSwatch: {
    backgroundColor: theme.colors.border,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
    borderStyle: 'dashed',
  },
  variantRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 12,
  },
  variantLabel: {
    color: theme.colors.textDisabled,
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  variantSwatch: {
    alignItems: 'center',
    marginRight: 10,
    padding: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  variantSwatchChosen: {
    borderColor: theme.colors.primary,
  },
  variantSwatchColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
  },
  variantSwatchName: {
    color: theme.colors.placeholder,
    fontSize: 10,
    maxWidth: 50,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.error,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
  },
  saveButton: {
    margin: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.borderSubtle,
  },
  saveButtonText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 16,
  },
});
