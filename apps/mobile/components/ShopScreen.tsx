import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animation, AvatarInventoryEntry, AvatarItem, Item, PaginatedAnimations, PaginatedAvatarItems, PaginatedItems } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { AppText, Button, CoinPill, EmptyState, ScreenHeader, SegmentedControl, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useMe } from '@/hooks/useMe';
import { ownedCounts, useInventory } from '@/hooks/useInventory';
import ShopItemCard from './ShopItemCard';
import AvatarShopItemCard from './AvatarShopItemCard';
import ItemDetailModal from './ItemDetailModal';
import { ALL_CATEGORY, CategoryChips } from './CategoryChips';

const LIMIT = 20;

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
    const { data: inventory = [] } = useInventory({ enabled: !!userId && shopTab === 'items' });
    const owned = ownedCounts(inventory);

    // ── Items tab queries ────────────────────────────────────────────────────
    const { data: categories = [] } = useQuery<string[]>({
        queryKey: ['shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/categories'),
        enabled: !!userId && shopTab === 'items',
    });

    const categoryParam = selectedCategory === ALL_CATEGORY ? '' : selectedCategory;
    const { data: itemsData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isLoadingItems } =
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

    const items: Item[] = itemsData?.pages.flatMap((p) => p.items) ?? [];

    const { mutate: buyItem } = useMutation({
        mutationFn: (itemId: string) => api.post<unknown>('/api/v1/shop/buy', { itemId }),
        onMutate: (itemId) => setBuyingItemId(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            setModalVisible(false);
            Alert.alert('Purchased!', 'Item added to your inventory.');
        },
        onError: (err: Error) => Alert.alert('Purchase failed', err.message),
        onSettled: () => setBuyingItemId(null),
    });

    // ── Outfits tab queries ──────────────────────────────────────────────────
    const { data: outfitCategories = [] } = useQuery<string[]>({
        queryKey: ['avatar-shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/avatar-items/categories'),
        enabled: !!userId && shopTab === 'outfits',
    });

    const outfitCategoryParam = selectedOutfitCategory === ALL_CATEGORY ? '' : selectedOutfitCategory;
    const { data: outfitsData, fetchNextPage: fetchNextOutfitsPage, hasNextPage: hasNextOutfitsPage, isFetchingNextPage: isFetchingNextOutfitsPage, isLoading: isLoadingOutfits } =
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

    const outfitItems: AvatarItem[] = outfitsData?.pages.flatMap((p) => p.items) ?? [];

    const { data: avatarInventory = [] } = useQuery<AvatarInventoryEntry[]>({
        queryKey: ['avatar-inventory'],
        queryFn: () => api.get<AvatarInventoryEntry[]>('/api/v1/inventory/avatar'),
        enabled: !!userId && shopTab === 'outfits',
    });

    const ownedVariantIds = avatarInventory.map((e) => e.variantId);

    // ── Animations tab queries ───────────────────────────────────────────────
    const { data: animationCategories = [] } = useQuery<string[]>({
        queryKey: ['animation-shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/animations/categories'),
        enabled: !!userId && shopTab === 'animations',
    });

    const animationCategoryParam = selectedAnimationCategory === ALL_CATEGORY ? '' : selectedAnimationCategory;
    const { data: animationsData, fetchNextPage: fetchNextAnimationsPage, hasNextPage: hasNextAnimationsPage, isFetchingNextPage: isFetchingNextAnimationsPage, isLoading: isLoadingAnimations } =
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

    const animationItems: Animation[] = animationsData?.pages.flatMap((p) => p.animations) ?? [];

    const { data: ownedAnimations = [] } = useQuery<Animation[]>({
        queryKey: ['animation-inventory'],
        queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
        enabled: !!userId && shopTab === 'animations',
    });

    const ownedAnimationIds = new Set(ownedAnimations.map((a) => a._id));

    const { mutate: buyAnimation } = useMutation({
        mutationFn: (animationId: string) => api.post<unknown>('/api/v1/shop/animations/buy', { animationId }),
        onMutate: (animationId) => setBuyingAnimationId(animationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['animation-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            Alert.alert('Purchased!', 'Animation added to your collection.');
        },
        onError: (err: Error) => Alert.alert('Purchase failed', err.message),
        onSettled: () => setBuyingAnimationId(null),
    });

    const { mutate: buyOutfit } = useMutation({
        mutationFn: ({ itemId, variantId }: { itemId: string; variantId: string }) =>
            api.post<unknown>('/api/v1/shop/avatar-items/buy', { itemId, variantId }),
        onMutate: ({ itemId, variantId }) => setBuyingOutfitKey(`${itemId}:${variantId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['avatar-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            Alert.alert('Purchased!', 'Outfit added to your wardrobe.');
        },
        onError: (err: Error) => Alert.alert('Purchase failed', err.message),
        onSettled: () => setBuyingOutfitKey(null),
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScreenHeader large title="Shop" right={coins !== undefined ? <CoinPill coins={coins} /> : undefined} />
            <SegmentedControl options={TABS} value={shopTab} onChange={setShopTab} style={styles.tabSwitcher} />

            {shopTab === 'items' && (
                <>
                    <CategoryChips categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
                    {isLoadingItems ? (
                        <Spinner style={styles.loader} size="large" />
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.list}
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
                    <CategoryChips categories={outfitCategories} selected={selectedOutfitCategory} onSelect={setSelectedOutfitCategory} />
                    {isLoadingOutfits ? (
                        <Spinner style={styles.loader} size="large" />
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
                            ListFooterComponent={isFetchingNextOutfitsPage ? <Spinner style={styles.footer} /> : undefined}
                            ListEmptyComponent={<EmptyState icon="shirt-outline" title="No outfits yet" body="New styles are on the way." />}
                        />
                    )}
                </>
            )}

            {shopTab === 'animations' && (
                <>
                    <CategoryChips categories={animationCategories} selected={selectedAnimationCategory} onSelect={setSelectedAnimationCategory} />
                    {isLoadingAnimations ? (
                        <Spinner style={styles.loader} size="large" />
                    ) : (
                        <FlatList
                            data={animationItems}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.list}
                            renderItem={({ item }) => {
                                const owned = ownedAnimationIds.has(item._id);
                                const isBuying = buyingAnimationId === item._id;
                                return (
                                    <View style={styles.animationRow}>
                                        <View style={styles.animationInfo}>
                                            <AppText variant="heading">{item.name}</AppText>
                                            <AppText variant="overline" color="textMuted">{item.category}</AppText>
                                        </View>
                                        <Button
                                            title={owned ? 'Owned' : `${item.price.coins} coins`}
                                            icon={owned ? 'checkmark' : 'star'}
                                            variant={owned ? 'secondary' : 'reward'}
                                            size="sm"
                                            loading={isBuying}
                                            disabled={owned}
                                            onPress={() => buyAnimation(item._id)}
                                        />
                                    </View>
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
    loader: { flex: 1 },
    footer: { paddingVertical: t.space.lg },
    list: { paddingTop: t.space.xs, paddingBottom: t.space.xl, gap: t.space.md },
    animationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        marginHorizontal: t.space.lg,
        padding: t.space.md,
        paddingLeft: t.space.lg,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
        ...t.shadows.sticker,
    },
    animationInfo: { flex: 1, gap: 2 },
}));
