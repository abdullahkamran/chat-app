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
import { Item, PaginatedItems } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import ShopItemCard from './ShopItemCard';

const LIMIT = 20;
const ALL_CATEGORY = '__all__';

export default function ShopScreen(): React.JSX.Element {
    const { userId } = useAuth();
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
    const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

    const { data: categories = [] } = useQuery<string[]>({
        queryKey: ['shop', 'categories'],
        queryFn: () => api.get<string[]>('/api/v1/shop/categories'),
        enabled: !!userId,
    });

    const categoryParam = selectedCategory === ALL_CATEGORY ? '' : selectedCategory;

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useInfiniteQuery<PaginatedItems>({
            queryKey: ['shop', 'items', selectedCategory],
            queryFn: ({ pageParam = 1 }) =>
                api.get<PaginatedItems>(
                    `/api/v1/shop/items?page=${pageParam}&limit=${LIMIT}${categoryParam ? `&category=${encodeURIComponent(categoryParam)}` : ''}`
                ),
            initialPageParam: 1,
            getNextPageParam: (lastPage) =>
                lastPage.hasMore ? lastPage.page + 1 : undefined,
            enabled: !!userId,
        });

    const items: Item[] = data?.pages.flatMap((p) => p.items) ?? [];

    const { mutate: buyItem } = useMutation({
        mutationFn: (itemId: string) => api.post<unknown>('/api/v1/shop/buy', { itemId }),
        onMutate: (itemId) => setBuyingItemId(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            Alert.alert('Purchased!', 'Item added to your inventory.');
        },
        onError: (err: Error) => Alert.alert('Purchase failed', err.message),
        onSettled: () => setBuyingItemId(null),
    });

    return (
        <View style={styles.container}>
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

            {isLoading ? (
                <ActivityIndicator style={styles.loader} size="large" color="#FFFC00" />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <ShopItemCard
                            item={item}
                            onBuy={() => buyItem(item._id)}
                            isBuying={buyingItemId === item._id}
                        />
                    )}
                    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        isFetchingNextPage
                            ? <ActivityIndicator style={styles.footer} color="#FFFC00" />
                            : null
                    }
                    ListEmptyComponent={
                        <Text style={styles.empty}>No items available.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    categoryBar: {
        flexGrow: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#222',
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
        borderColor: '#444',
    },
    categoryChipActive: { backgroundColor: '#FFFC00', borderColor: '#FFFC00' },
    categoryText: { color: '#888', fontSize: 13, fontWeight: '500' },
    categoryTextActive: { color: '#000' },
    loader: { flex: 1, justifyContent: 'center' },
    footer: { paddingVertical: 16 },
    empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
