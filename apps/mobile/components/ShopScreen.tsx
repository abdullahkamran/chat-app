import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animation, AvatarInventoryEntry, AvatarItem, Item, PaginatedAnimations, PaginatedAvatarItems, PaginatedItems } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { Button, CoinPill, EmptyState, ErrorState, ScreenHeader, SegmentedControl, SkeletonGroup, Spinner, showErrorDialog } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { makeStyles } from '@/constants/theme';
import { useMe } from '@/hooks/useMe';
import { ownedCounts, useInventory } from '@/hooks/useInventory';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import ShopItemCard, { ShopItemCardSkeleton } from './ShopItemCard';
import AvatarShopItemCard, { AvatarShopItemCardSkeleton } from './AvatarShopItemCard';
import ItemDetailModal from './ItemDetailModal';
import { ALL_CATEGORY, CategoryChips } from './CategoryChips';
import AnimationRow, { AnimationRowSkeleton, animationCategoryLabel, useVisibleIds } from './AnimationRow';

const LIMIT = 20;
/** How many placeholder cards a loading tab shows: about a screenful. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

type ShopTab = 'items' | 'outfits' | 'animations';

const TABS = [
    { value: 'items', label: 'Items' },
    { value: 'outfits', label: 'Outfits' },
    { value: 'animations', label: 'Animations' },
] as const;

export default function ShopScreen(): React.JSX.Element {
    const { userId } = useAuth();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const styles = useStyles();
    const coins = useMe().data?.amount.coins;

    const [shopTab, setShopTab] = useState<ShopTab>('items');

    // ── Items tab state ──────────────────────────────────────────────────────
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
    const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // ── Outfits tab state ────────────────────────────────────────────────────
    const [selectedOutfitCategory, setSelectedOutfitCategory] = useState<string>(ALL_CATEGORY);
    const [buyingOutfitKey, setBuyingOutfitKey] = useState<string | null>(null);

    // ── Animations tab state ─────────────────────────────────────────────────
    const [selectedAnimationCategory, setSelectedAnimationCategory] = useState<string>(ALL_CATEGORY);
    const [buyingAnimationId, setBuyingAnimationId] = useState<string | null>(null);

    // ── Items tab: how many of each the user owns, free and placed ───────────
    const inventoryQuery = useInventory({ enabled: !!userId && shopTab === 'items' });
    const inventory = inventoryQuery.data ?? [];
    const owned = ownedCounts(inventory);

    // ── Items tab queries ────────────────────────────────────────────────────
    const { data: categories = [], isLoading: isLoadingCategories } = useQuery<string[]>({
        queryKey: ['shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/categories'),
        enabled: !!userId && shopTab === 'items',
    });

    const categoryParam = selectedCategory === ALL_CATEGORY ? '' : selectedCategory;
    const itemsQuery =
        useInfiniteQuery<PaginatedItems>({
            queryKey: ['shop', 'items', selectedCategory],
            queryFn: ({ pageParam = 1 }) =>
                api.get<PaginatedItems>(
                    `/api/v1/shop/items?page=${pageParam}&limit=${LIMIT}${categoryParam ? `&category=${encodeURIComponent(categoryParam)}` : ''}`
                ),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
            enabled: !!userId && shopTab === 'items',
        });

    const { data: itemsData, fetchNextPage, hasNextPage, isFetchingNextPage } = itemsQuery;
    const items: Item[] = itemsData?.pages.flatMap((p) => p.items) ?? [];
    // What the user owns changes what each card says, so it's part of the first load.
    const isLoadingItems = itemsQuery.isLoading || inventoryQuery.isLoading;

    const { mutate: buyItem } = useMutation({
        mutationFn: (itemId: string) => api.post<unknown>('/api/v1/shop/buy', { itemId }),
        onMutate: (itemId) => setBuyingItemId(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            setModalVisible(false);
            showToast({ text: 'Purchased! Item added to your inventory.', icon: 'bag-check' });
        },
        onError: (err: Error) => showErrorDialog(err, 'Purchase failed'),
        onSettled: () => setBuyingItemId(null),
    });

    // ── Outfits tab queries ──────────────────────────────────────────────────
    const { data: outfitCategories = [], isLoading: isLoadingOutfitCategories } = useQuery<string[]>({
        queryKey: ['avatar-shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/avatar-items/categories'),
        enabled: !!userId && shopTab === 'outfits',
    });

    const outfitCategoryParam = selectedOutfitCategory === ALL_CATEGORY ? '' : selectedOutfitCategory;
    const outfitsQuery =
        useInfiniteQuery<PaginatedAvatarItems>({
            queryKey: ['avatar-shop', 'items', selectedOutfitCategory],
            queryFn: ({ pageParam = 1 }) =>
                api.get<PaginatedAvatarItems>(
                    `/api/v1/shop/avatar-items?page=${pageParam}&limit=${LIMIT}${outfitCategoryParam ? `&category=${encodeURIComponent(outfitCategoryParam)}` : ''}`
                ),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
            enabled: !!userId && shopTab === 'outfits',
        });

    const { data: outfitsData, fetchNextPage: fetchNextOutfitsPage, hasNextPage: hasNextOutfitsPage, isFetchingNextPage: isFetchingNextOutfitsPage } = outfitsQuery;
    const outfitItems: AvatarItem[] = outfitsData?.pages.flatMap((p) => p.items) ?? [];

    const avatarInventoryQuery = useQuery<AvatarInventoryEntry[]>({
        queryKey: ['avatar-inventory'],
        queryFn: () => api.get<AvatarInventoryEntry[]>('/api/v1/inventory/avatar'),
        enabled: !!userId && shopTab === 'outfits',
    });

    const ownedVariantIds = (avatarInventoryQuery.data ?? []).map((e) => e.variantId);
    const isLoadingOutfits = outfitsQuery.isLoading || avatarInventoryQuery.isLoading;

    // ── Animations tab queries ───────────────────────────────────────────────
    const { data: animationCategories = [], isLoading: isLoadingAnimationCategories } = useQuery<string[]>({
        queryKey: ['animation-shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/animations/categories'),
        enabled: !!userId && shopTab === 'animations',
    });

    const animationCategoryParam = selectedAnimationCategory === ALL_CATEGORY ? '' : selectedAnimationCategory;
    const animationsQuery =
        useInfiniteQuery<PaginatedAnimations>({
            queryKey: ['animation-shop', 'items', selectedAnimationCategory],
            queryFn: ({ pageParam = 1 }) =>
                api.get<PaginatedAnimations>(
                    `/api/v1/shop/animations?page=${pageParam}&limit=${LIMIT}${animationCategoryParam ? `&category=${encodeURIComponent(animationCategoryParam)}` : ''}`
                ),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
            enabled: !!userId && shopTab === 'animations',
        });

    const { data: animationsData, fetchNextPage: fetchNextAnimationsPage, hasNextPage: hasNextAnimationsPage, isFetchingNextPage: isFetchingNextAnimationsPage } = animationsQuery;
    const animationItems: Animation[] = animationsData?.pages.flatMap((p) => p.animations) ?? [];

    const ownedAnimationsQuery = useQuery<Animation[]>({
        queryKey: ['animation-inventory'],
        queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
        enabled: !!userId && shopTab === 'animations',
    });

    const { visible: visibleAnimationIds, listProps: animationListProps } = useVisibleIds(shopTab === 'animations');
    const ownedAnimationIds = new Set((ownedAnimationsQuery.data ?? []).map((a) => a._id));
    const isLoadingAnimations = animationsQuery.isLoading || ownedAnimationsQuery.isLoading;

    // Pull to refresh reloads the open tab: its list and what the user owns.
    const refreshItems = usePullToRefresh(() => Promise.all([itemsQuery.refetch(), inventoryQuery.refetch()]));
    const refreshOutfits = usePullToRefresh(() => Promise.all([outfitsQuery.refetch(), avatarInventoryQuery.refetch()]));
    const refreshAnimations = usePullToRefresh(() => Promise.all([animationsQuery.refetch(), ownedAnimationsQuery.refetch()]));

    const { mutate: buyAnimation } = useMutation({
        mutationFn: (animationId: string) => api.post<unknown>('/api/v1/shop/animations/buy', { animationId }),
        onMutate: (animationId) => setBuyingAnimationId(animationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['animation-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            showToast({ text: 'Purchased! Animation added to your collection.', icon: 'bag-check' });
        },
        onError: (err: Error) => showErrorDialog(err, 'Purchase failed'),
        onSettled: () => setBuyingAnimationId(null),
    });

    const { mutate: buyOutfit } = useMutation({
        mutationFn: ({ itemId, variantId }: { itemId: string; variantId: string }) =>
            api.post<unknown>('/api/v1/shop/avatar-items/buy', { itemId, variantId }),
        onMutate: ({ itemId, variantId }) => setBuyingOutfitKey(`${itemId}:${variantId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['avatar-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            showToast({ text: 'Purchased! Outfit added to your wardrobe.', icon: 'bag-check' });
        },
        onError: (err: Error) => showErrorDialog(err, 'Purchase failed'),
        onSettled: () => setBuyingOutfitKey(null),
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScreenHeader large title="Shop" right={<CoinPill coins={coins} />} />
            <SegmentedControl options={TABS} value={shopTab} onChange={setShopTab} style={styles.tabSwitcher} />

            {shopTab === 'items' && (
                <>
                    <CategoryChips categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} loading={isLoadingCategories} />
                    {isLoadingItems ? (
                        <SkeletonGroup style={styles.list} label="Loading items">
                            {SKELETON_ROWS.map(i => <ShopItemCardSkeleton key={i} />)}
                        </SkeletonGroup>
                    ) : (itemsQuery.isError && !itemsData) || (inventoryQuery.isError && !inventoryQuery.data) ? (
                        <ErrorState
                            title="Couldn't load the shop"
                            onRetry={() => { itemsQuery.refetch(); inventoryQuery.refetch(); }}
                            retrying={itemsQuery.isRefetching || inventoryQuery.isRefetching}
                        />
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.list}
                            refreshControl={refreshItems}
                            renderItem={({ item }) => (
                                <ShopItemCard
                                    item={item}
                                    ownedCount={owned[item._id]?.owned ?? 0}
                                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                                />
                            )}
                            onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={isFetchingNextPage ? <Spinner style={styles.footer} /> : undefined}
                            ListEmptyComponent={<EmptyState icon="cube-outline" title="Nothing here yet" body="Check back soon for new furniture." />}
                        />
                    )}
                </>
            )}

            {shopTab === 'outfits' && (
                <>
                    <CategoryChips categories={outfitCategories} selected={selectedOutfitCategory} onSelect={setSelectedOutfitCategory} loading={isLoadingOutfitCategories} />
                    {isLoadingOutfits ? (
                        <SkeletonGroup style={styles.list} label="Loading outfits">
                            {SKELETON_ROWS.slice(0, 3).map(i => <AvatarShopItemCardSkeleton key={i} />)}
                        </SkeletonGroup>
                    ) : (outfitsQuery.isError && !outfitsData) || (avatarInventoryQuery.isError && !avatarInventoryQuery.data) ? (
                        <ErrorState
                            title="Couldn't load outfits"
                            onRetry={() => { outfitsQuery.refetch(); avatarInventoryQuery.refetch(); }}
                            retrying={outfitsQuery.isRefetching || avatarInventoryQuery.isRefetching}
                        />
                    ) : (
                        <FlatList
                            data={outfitItems}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <AvatarShopItemCard
                                    item={item}
                                    ownedVariantIds={ownedVariantIds}
                                    onBuy={(itemId, variantId) => buyOutfit({ itemId, variantId })}
                                    buyingKey={buyingOutfitKey}
                                />
                            )}
                            onEndReached={() => { if (hasNextOutfitsPage && !isFetchingNextOutfitsPage) fetchNextOutfitsPage(); }}
                            onEndReachedThreshold={0.4}
                            contentContainerStyle={styles.list}
                            refreshControl={refreshOutfits}
                            ListFooterComponent={isFetchingNextOutfitsPage ? <Spinner style={styles.footer} /> : undefined}
                            ListEmptyComponent={<EmptyState icon="shirt-outline" title="No outfits yet" body="New styles are on the way." />}
                        />
                    )}
                </>
            )}

            {shopTab === 'animations' && (
                <>
                    <CategoryChips categories={animationCategories} selected={selectedAnimationCategory} onSelect={setSelectedAnimationCategory} loading={isLoadingAnimationCategories} labelOf={animationCategoryLabel} />
                    {isLoadingAnimations ? (
                        <SkeletonGroup style={styles.list} label="Loading animations">
                            {SKELETON_ROWS.slice(0, 4).map(i => <AnimationRowSkeleton key={i} withAction />)}
                        </SkeletonGroup>
                    ) : (animationsQuery.isError && !animationsData) || (ownedAnimationsQuery.isError && !ownedAnimationsQuery.data) ? (
                        <ErrorState
                            title="Couldn't load animations"
                            onRetry={() => { animationsQuery.refetch(); ownedAnimationsQuery.refetch(); }}
                            retrying={animationsQuery.isRefetching || ownedAnimationsQuery.isRefetching}
                        />
                    ) : (
                        <FlatList
                            data={animationItems}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.list}
                            refreshControl={refreshAnimations}
                            {...animationListProps}
                            renderItem={({ item }) => {
                                const owned = ownedAnimationIds.has(item._id);
                                const isBuying = buyingAnimationId === item._id;
                                return (
                                    <AnimationRow
                                        animation={item}
                                        animated={visibleAnimationIds.has(item._id)}
                                        action={
                                            <Button
                                                title={owned ? 'Owned' : item.price.coins === 0 ? 'Free' : `${item.price.coins} coins`}
                                                icon={owned ? 'checkmark' : 'star'}
                                                variant={owned ? 'secondary' : 'reward'}
                                                size="sm"
                                                loading={isBuying}
                                                disabled={owned}
                                                onPress={() => buyAnimation(item._id)}
                                            />
                                        }
                                    />
                                );
                            }}
                            onEndReached={() => { if (hasNextAnimationsPage && !isFetchingNextAnimationsPage) fetchNextAnimationsPage(); }}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={isFetchingNextAnimationsPage ? <Spinner style={styles.footer} /> : undefined}
                            ListEmptyComponent={<EmptyState icon="musical-notes-outline" title="No animations yet" body="New moves are on the way." />}
                        />
                    )}
                </>
            )}
            <ItemDetailModal
                item={selectedItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onBuy={(itemId) => buyItem(itemId)}
                isBuying={selectedItem ? buyingItemId === selectedItem._id : false}
                ownedCount={selectedItem ? (owned[selectedItem._id]?.owned ?? 0) : 0}
                placedCount={selectedItem ? (owned[selectedItem._id]?.placed ?? 0) : 0}
            />
        </View>
    );
}

const useStyles = makeStyles(t => ({
    container: { flex: 1, backgroundColor: t.colors.background },
    tabSwitcher: { marginHorizontal: t.space.lg, marginBottom: t.space.xs },
    footer: { paddingVertical: t.space.lg },
    list: { paddingTop: t.space.xs, paddingBottom: t.space.xl, gap: t.space.md },
}));
