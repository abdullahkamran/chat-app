import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animation, AvatarItem, Item } from '@chat-app/shared-types';
import { useInventory } from '@/hooks/useInventory';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { AppText, Badge, EmptyState, ErrorState, ScreenHeader, SegmentedControl, Skeleton, SkeletonGroup } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveAvatarSource, resolveItemSource } from '@/constants/avatarAssets';
import ItemDetailModal from './ItemDetailModal';
import AnimationRow, { AnimationRowSkeleton, animationCategoryLabel, useVisibleIds } from './AnimationRow';
import { ALL_CATEGORY, CategoryChips } from './CategoryChips';

type InventoryTab = 'items' | 'outfits' | 'animations';

const TABS = [
    { value: 'items', label: 'Items' },
    { value: 'outfits', label: 'Outfits' },
    { value: 'animations', label: 'Animations' },
] as const;

// Populated entry returned from the API: item field is the full AvatarItem object
type PopulatedAvatarInventoryEntry = {
    item: AvatarItem;
    variantId: string;
};

/** The categories in a list, in first-seen order, and the entries in the selected one. */
function useCategoryFilter<T>(entries: T[], categoryOf: (entry: T) => string | undefined) {
    const [selected, setSelected] = useState<string>(ALL_CATEGORY);
    const categories = useMemo(
        () => [...new Set(entries.map(categoryOf).filter((c): c is string => !!c))],
        // categoryOf is a fresh arrow each render; the entries decide the categories.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entries],
    );
    // A category that emptied out (its last item placed or sold) falls back to All.
    const active = categories.includes(selected) ? selected : ALL_CATEGORY;
    const filtered = active === ALL_CATEGORY ? entries : entries.filter(e => categoryOf(e) === active);
    return { categories, selected: active, setSelected, filtered, isFiltered: active !== ALL_CATEGORY };
}

const useStyles = makeStyles(t => ({
    container: { flex: 1, backgroundColor: t.colors.background },
    tabSwitcher: { marginHorizontal: t.space.lg, marginBottom: t.space.xs },
    animationsList: { paddingTop: t.space.xs, gap: t.space.md },
    skeletonRow: { borderColor: t.colors.surface },
    skeletonInfo: { flex: 1, gap: t.space.sm },
    list: { paddingBottom: t.space.xl, gap: t.space.sm + 2 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        marginHorizontal: t.space.lg,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
    },
    thumbTile: {
        width: 52,
        height: 52,
        borderRadius: t.radius.md,
        backgroundColor: t.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemThumb: { width: 44, height: 44 },
    info: { flex: 1, gap: 2 },
    swatch: {
        width: 40,
        height: 40,
        borderRadius: t.radius.pill,
    },
    swatchColor: {
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.outline,
    },
    tag: {
        paddingHorizontal: t.space.sm + 2,
        paddingVertical: t.space.xs,
        borderRadius: t.radius.pill,
        backgroundColor: t.colors.surfaceElevated,
    },
}));

/** Placeholder rows shaped like the inventory list, while a tab loads. */
function InventoryRowsSkeleton({ round = false }: Readonly<{ round?: boolean }>) {
    const styles = useStyles();
    return (
        <SkeletonGroup style={styles.list} label="Loading inventory">
            {[0, 1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[styles.row, styles.skeletonRow]}>
                    {round ? <Skeleton width={40} height={40} radius="circle" /> : <Skeleton width={52} height={52} radius="md" />}
                    <View style={styles.skeletonInfo}>
                        <Skeleton width="50%" height={16} radius="xs" />
                        <Skeleton width="30%" height={10} radius="xs" />
                    </View>
                </View>
            ))}
        </SkeletonGroup>
    );
}

export default function InventoryScreen(): React.JSX.Element {
    const t = useTheme();
    const styles = useStyles();
    const { userId } = useAuth();
    const insets = useSafeAreaInsets();
    const [inventoryTab, setInventoryTab] = useState<InventoryTab>('items');

    const itemsQuery = useInventory({ enabled: !!userId && inventoryTab === 'items' });
    const entries = itemsQuery.data ?? [];

    const outfitsQuery = useQuery<PopulatedAvatarInventoryEntry[]>({
        queryKey: ['avatar-inventory'],
        queryFn: () => api.get<PopulatedAvatarInventoryEntry[]>('/api/v1/inventory/avatar'),
        enabled: !!userId && inventoryTab === 'outfits',
    });
    const avatarInventory = outfitsQuery.data ?? [];

    const animationsQuery = useQuery<Animation[]>({
        queryKey: ['animation-inventory'],
        queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
        enabled: !!userId && inventoryTab === 'animations',
    });
    const animations = animationsQuery.data ?? [];

    const itemFilter = useCategoryFilter(entries, e => e.item.category);
    const outfitFilter = useCategoryFilter(avatarInventory, e => e.item?.category);
    const animationFilter = useCategoryFilter(animations, a => a.category);
    const { visible: visibleAnimationIds, listProps: animationListProps } = useVisibleIds(inventoryTab === 'animations');

    const refreshItems = usePullToRefresh(itemsQuery.refetch);
    const refreshOutfits = usePullToRefresh(outfitsQuery.refetch);
    const refreshAnimations = usePullToRefresh(animationsQuery.refetch);

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const tag = (label: string) => (
        <View style={styles.tag}>
            <AppText variant="overline" color="textSecondary">{label}</AppText>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScreenHeader large title="Inventory" />
            <SegmentedControl options={TABS} value={inventoryTab} onChange={setInventoryTab} style={styles.tabSwitcher} />

            {inventoryTab === 'animations' ? (
                <>
                <CategoryChips categories={animationFilter.categories} selected={animationFilter.selected} onSelect={animationFilter.setSelected} loading={animationsQuery.isLoading} labelOf={animationCategoryLabel} />
                {animationsQuery.isLoading ? (
                    <SkeletonGroup style={[styles.list, styles.animationsList]} label="Loading animations">
                        {[0, 1, 2, 3].map(i => <AnimationRowSkeleton key={i} />)}
                    </SkeletonGroup>
                ) : animationsQuery.isError && !animationsQuery.data ? (
                    <ErrorState title="Couldn't load your animations" onRetry={() => animationsQuery.refetch()} retrying={animationsQuery.isRefetching} />
                ) : (
                    <FlatList
                        data={animationFilter.filtered}
                        keyExtractor={(a) => a._id}
                        contentContainerStyle={[styles.list, styles.animationsList]}
                        refreshControl={refreshAnimations}
                        {...animationListProps}
                        renderItem={({ item: anim }) => (
                            <AnimationRow animation={anim} animated={visibleAnimationIds.has(anim._id)} />
                        )}
                        ListEmptyComponent={
                            <EmptyState icon="musical-notes-outline" title="No animations yet" body="Visit the Shop to pick up some moves!" />
                        }
                    />
                )}
                </>
            ) : inventoryTab === 'items' ? (
                <>
                <CategoryChips categories={itemFilter.categories} selected={itemFilter.selected} onSelect={itemFilter.setSelected} loading={itemsQuery.isLoading} />
                {itemsQuery.isLoading ? (
                    <InventoryRowsSkeleton />
                ) : itemsQuery.isError && !itemsQuery.data ? (
                    <ErrorState title="Couldn't load your items" onRetry={() => itemsQuery.refetch()} retrying={itemsQuery.isRefetching} />
                ) : (
                    <FlatList
                        data={itemFilter.filtered}
                        keyExtractor={({ item }) => item._id}
                        contentContainerStyle={styles.list}
                        refreshControl={refreshItems}
                        renderItem={({ item: { item, count, placed } }) => {
                            const source = resolveItemSource(item.assetUrl);
                            return (
                                <Pressable
                                    style={({ pressed }) => [styles.row, pressed ? { transform: [{ translateY: t.pressDepth }] } : t.shadows.sticker]}
                                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                                >
                                    <View style={styles.thumbTile}>
                                        {source && <Image source={source} style={styles.itemThumb} contentFit="contain" transition={t.motion.fast} />}
                                        {/* Copies free to place; ones standing in rooms are counted below. */}
                                        <Badge count={count} showZero tone={count > 0 ? 'primary' : 'muted'} ringColor={t.colors.surface} />
                                    </View>
                                    <View style={styles.info}>
                                        <AppText variant="heading" numberOfLines={1}>{item.name}</AppText>
                                        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                                            {placed > 0 ? `${item.category} · ${placed} in rooms` : item.category}
                                        </AppText>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={
                            <EmptyState icon="cube-outline" title="Your inventory is empty" body="Visit the Shop to find furniture for your room!" />
                        }
                    />
                )}
                </>
            ) : (
                <>
                <CategoryChips categories={outfitFilter.categories} selected={outfitFilter.selected} onSelect={outfitFilter.setSelected} loading={outfitsQuery.isLoading} />
                {outfitsQuery.isLoading ? (
                    <InventoryRowsSkeleton round />
                ) : outfitsQuery.isError && !outfitsQuery.data ? (
                    <ErrorState title="Couldn't load your outfits" onRetry={() => outfitsQuery.refetch()} retrying={outfitsQuery.isRefetching} />
                ) : (
                    <FlatList
                        data={outfitFilter.filtered}
                        keyExtractor={(entry, index) => `${entry.item?._id ?? index}-${entry.variantId}`}
                        contentContainerStyle={styles.list}
                        refreshControl={refreshOutfits}
                        renderItem={({ item: entry }) => {
                            const variant = entry.item?.variants?.find((v) => v._id === entry.variantId);
                            const source = resolveAvatarSource(variant?.sourceUrl ?? '');
                            return (
                                <View style={styles.row}>
                                    {source
                                        ? <Image source={source} style={styles.swatch} contentFit="contain" transition={t.motion.fast} />
                                        : <View style={[styles.swatch, styles.swatchColor, { backgroundColor: variant?.color ?? t.colors.border }]} />
                                    }
                                    <View style={styles.info}>
                                        <AppText variant="heading" numberOfLines={1}>{entry.item?.name ?? '—'}</AppText>
                                        <AppText variant="caption" color="textSecondary">{variant?.name ?? entry.variantId}</AppText>
                                    </View>
                                    {entry.item?.category ? tag(entry.item.category) : null}
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <EmptyState icon="shirt-outline" title="No outfits yet" body="Visit the Shop to find something to wear!" />
                        }
                    />
                )}
                </>
            )}

            <ItemDetailModal
                item={selectedItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
}
