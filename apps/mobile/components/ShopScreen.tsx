import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Animation, AvatarInventoryEntry, AvatarItem, Item, PaginatedAnimations, PaginatedAvatarItems, PaginatedItems } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { theme } from '@/constants/theme';
import ShopItemCard from './ShopItemCard';
import AvatarShopItemCard from './AvatarShopItemCard';
import ItemDetailModal from './ItemDetailModal';

const LIMIT = 20;
const ALL_CATEGORY = '__all__';

type ShopTab = 'items' | 'outfits' | 'animations';

export default function ShopScreen(): React.JSX.Element {
    const { userId } = useAuth();
    const queryClient = useQueryClient();

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

    // ── Items tab: inventory (to show owned-count warning) ──────────────────
    const { data: ownedItems = [] } = useQuery<Item[]>({
        queryKey: ['inventory'],
        queryFn: () => api.get<Item[]>('/api/v1/inventory'),
        enabled: !!userId && shopTab === 'items',
    });

    const ownedItemCounts = ownedItems.reduce<Record<string, number>>((acc, item) => {
        acc[item._id] = (acc[item._id] ?? 0) + 1;
        return acc;
    }, {});

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
            Alert.alert('Purchased!', 'Outfit added to your wardrobe.');
        },
        onError: (err: Error) => Alert.alert('Purchase failed', err.message),
        onSettled: () => setBuyingOutfitKey(null),
    });

    return (
        <View style={styles.container}>
            {/* ── Tab switcher ── */}
            <View style={styles.tabSwitcher}>
                <TouchableOpacity
                    style={[styles.pill, shopTab === 'items' && styles.pillActive]}
                    onPress={() => setShopTab('items')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, shopTab === 'items' && styles.pillTextActive]}>
                        Items
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.pill, shopTab === 'outfits' && styles.pillActive]}
                    onPress={() => setShopTab('outfits')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, shopTab === 'outfits' && styles.pillTextActive]}>
                        Outfits
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.pill, shopTab === 'animations' && styles.pillActive]}
                    onPress={() => setShopTab('animations')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, shopTab === 'animations' && styles.pillTextActive]}>
                        Animations
                    </Text>
                </TouchableOpacity>
            </View>

            {shopTab === 'items' && (
                <>
                    {/* ── Category chips ── */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryBar}
                        contentContainerStyle={styles.categoryContent}
                    >
                        {[ALL_CATEGORY, ...categories].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                                    {cat === ALL_CATEGORY ? 'All' : cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {isLoadingItems ? (
                        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <ShopItemCard
                                    item={item}
                                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                                />
                            )}
                            onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={
                                isFetchingNextPage
                                    ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} />
                                    : null
                            }
                            ListEmptyComponent={
                                <Text style={styles.empty}>No items available.</Text>
                            }
                        />
                    )}
                </>
            )}

            {shopTab === 'outfits' && (
                <>
                    {/* ── Outfit category chips ── */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryBar}
                        contentContainerStyle={styles.categoryContent}
                    >
                        {[ALL_CATEGORY, ...outfitCategories].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, selectedOutfitCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSelectedOutfitCategory(cat)}
                            >
                                <Text style={[styles.categoryText, selectedOutfitCategory === cat && styles.categoryTextActive]}>
                                    {cat === ALL_CATEGORY ? 'All' : cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {isLoadingOutfits ? (
                        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
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
                            contentContainerStyle={styles.outfitList}
                            ListFooterComponent={
                                isFetchingNextOutfitsPage
                                    ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} />
                                    : null
                            }
                            ListEmptyComponent={
                                <Text style={styles.empty}>No outfits available.</Text>
                            }
                        />
                    )}
                </>
            )}

            {shopTab === 'animations' && (
                <>
                    {/* ── Animation category chips ── */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryBar}
                        contentContainerStyle={styles.categoryContent}
                    >
                        {[ALL_CATEGORY, ...animationCategories].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, selectedAnimationCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSelectedAnimationCategory(cat)}
                            >
                                <Text style={[styles.categoryText, selectedAnimationCategory === cat && styles.categoryTextActive]}>
                                    {cat === ALL_CATEGORY ? 'All' : cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {isLoadingAnimations ? (
                        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
                    ) : (
                        <FlatList
                            data={animationItems}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => {
                                const owned = ownedAnimationIds.has(item._id);
                                const isBuying = buyingAnimationId === item._id;
                                return (
                                    <View style={styles.animationRow}>
                                        <View style={styles.animationInfo}>
                                            <Text style={styles.animationName}>{item.name}</Text>
                                            <Text style={styles.animationCategory}>{item.category}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.animationBuyBtn, owned && styles.animationBuyBtnOwned]}
                                            onPress={() => !owned && buyAnimation(item._id)}
                                            disabled={owned || isBuying}
                                            activeOpacity={0.7}
                                        >
                                            {isBuying
                                                ? <ActivityIndicator size="small" color={theme.colors.primaryText} />
                                                : <Text style={[styles.animationBuyText, owned && styles.animationBuyTextOwned]}>
                                                    {owned ? 'Owned' : `${item.price.coins} coins`}
                                                </Text>
                                            }
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                            onEndReached={() => { if (hasNextAnimationsPage && !isFetchingNextAnimationsPage) fetchNextAnimationsPage(); }}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={
                                isFetchingNextAnimationsPage
                                    ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} />
                                    : null
                            }
                            ListEmptyComponent={
                                <Text style={styles.empty}>No animations available.</Text>
                            }
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
                ownedCount={selectedItem ? (ownedItemCounts[selectedItem._id] ?? 0) : 0}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    tabSwitcher: {
        flexDirection: 'row',
        padding: 12,
        gap: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    pill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
    },
    pillActive: { backgroundColor: theme.colors.primary },
    pillText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
    pillTextActive: { color: theme.colors.primaryText },
    categoryBar: {
        flexGrow: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    categoryContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        flexDirection: 'row',
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.borderSubtle,
    },
    categoryChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    categoryText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' },
    categoryTextActive: { color: theme.colors.primaryText },
    loader: { flex: 1, justifyContent: 'center' },
    footer: { paddingVertical: 16 },
    empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 },
    outfitList: { paddingVertical: 6 },
    animationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    animationInfo: { flex: 1, gap: 2 },
    animationName: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
    animationCategory: { color: theme.colors.textSecondary, fontSize: 12 },
    animationBuyBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 14,
        backgroundColor: theme.colors.primary,
        minWidth: 90,
        alignItems: 'center',
    },
    animationBuyBtnOwned: { backgroundColor: theme.colors.surface },
    animationBuyText: { color: theme.colors.primaryText, fontSize: 13, fontWeight: '700' },
    animationBuyTextOwned: { color: theme.colors.textMuted },
});
