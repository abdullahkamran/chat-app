import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { Animation, AvatarItem, Item } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { theme } from '@/constants/theme';
import { resolveAvatarSource, resolveItemSource } from '@/constants/avatarAssets';
import ItemDetailModal from './ItemDetailModal';

type InventoryTab = 'items' | 'outfits' | 'animations';

// Populated entry returned from the API: item field is the full AvatarItem object
type PopulatedAvatarInventoryEntry = {
    item: AvatarItem;
    variantId: string;
};

const ANIMATION_CATEGORY_LABEL: Record<string, string> = {
    EMOTE: 'Emote',
    WALK: 'Walk',
    SIT: 'Sit',
};

export default function InventoryScreen(): React.JSX.Element {
    const { userId } = useAuth();
    const [inventoryTab, setInventoryTab] = useState<InventoryTab>('items');

    const { data: items = [], isLoading: isLoadingItems } = useQuery<Item[]>({
        queryKey: ['inventory'],
        queryFn: () => api.get<Item[]>('/api/v1/inventory'),
        enabled: !!userId && inventoryTab === 'items',
    });

    const { data: avatarInventory = [], isLoading: isLoadingOutfits } = useQuery<PopulatedAvatarInventoryEntry[]>({
        queryKey: ['avatar-inventory'],
        queryFn: () => api.get<PopulatedAvatarInventoryEntry[]>('/api/v1/inventory/avatar'),
        enabled: !!userId && inventoryTab === 'outfits',
    });

    const { data: animations = [], isLoading: isLoadingAnimations } = useQuery<Animation[]>({
        queryKey: ['animation-inventory'],
        queryFn: () => api.get<Animation[]>('/api/v1/inventory/animations'),
        enabled: !!userId && inventoryTab === 'animations',
    });

    // Group duplicate items (canOwnMultiple) into { item, count } entries
    const groupedItems = items.reduce<Array<{ item: Item; count: number }>>((acc, item) => {
        const existing = acc.find((e) => e.item._id === item._id);
        if (existing) {
            existing.count++;
        } else {
            acc.push({ item, count: 1 });
        }
        return acc;
    }, []);

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <View style={styles.container}>
            {/* ── Tab switcher ── */}
            <View style={styles.tabSwitcher}>
                <TouchableOpacity
                    style={[styles.pill, inventoryTab === 'items' && styles.pillActive]}
                    onPress={() => setInventoryTab('items')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, inventoryTab === 'items' && styles.pillTextActive]}>
                        Items
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.pill, inventoryTab === 'outfits' && styles.pillActive]}
                    onPress={() => setInventoryTab('outfits')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, inventoryTab === 'outfits' && styles.pillTextActive]}>
                        Outfits
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.pill, inventoryTab === 'animations' && styles.pillActive]}
                    onPress={() => setInventoryTab('animations')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.pillText, inventoryTab === 'animations' && styles.pillTextActive]}>
                        Animations
                    </Text>
                </TouchableOpacity>
            </View>

            {inventoryTab === 'animations' ? (
                isLoadingAnimations ? (
                    <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
                ) : (
                    <FlatList
                        data={animations}
                        keyExtractor={(a) => a._id}
                        renderItem={({ item: anim }) => (
                            <View style={styles.row}>
                                <Text style={styles.name}>{anim.name}</Text>
                                <Text style={styles.categoryChip}>
                                    {ANIMATION_CATEGORY_LABEL[anim.category] ?? anim.category}
                                </Text>
                            </View>
                        )}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                No animations yet. Visit the Shop to buy some!
                            </Text>
                        }
                    />
                )
            ) : inventoryTab === 'items' ? (
                isLoadingItems ? (
                    <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
                ) : (
                    <FlatList
                        data={groupedItems}
                        keyExtractor={({ item }) => item._id}
                        renderItem={({ item: { item, count } }) => {
                            const source = resolveItemSource(item.assetUrl);
                            return (
                                <TouchableOpacity
                                    style={styles.row}
                                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.thumbWrapper}>
                                        {source
                                            ? <Image source={source} style={styles.itemThumb} contentFit="contain" />
                                            : <View style={[styles.itemThumb, styles.thumbPlaceholder]} />
                                        }
                                        {count > 1 && (
                                            <View style={styles.countBadge}>
                                                <Text style={styles.countBadgeText}>{count}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.name}>{item.name}</Text>
                                        <Text style={styles.category}>{item.category}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                Your inventory is empty. Visit the Shop to buy items!
                            </Text>
                        }
                    />
                )
            ) : (
                isLoadingOutfits ? (
                    <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
                ) : (
                    <FlatList
                        data={avatarInventory}
                        keyExtractor={(entry, index) => `${entry.item?._id ?? index}-${entry.variantId}`}
                        renderItem={({ item: entry }) => {
                            const variant = entry.item?.variants?.find((v) => v._id === entry.variantId);
                            const source = resolveAvatarSource(variant?.sourceUrl ?? '');
                            return (
                                <View style={styles.row}>
                                    <View style={styles.outfitLeft}>
                                        {source
                                            ? <Image source={source} style={styles.swatch} contentFit="contain" />
                                            : <View style={[styles.swatch, { backgroundColor: variant?.color ?? theme.colors.border }]} />
                                        }
                                        <View>
                                            <Text style={styles.name}>{entry.item?.name ?? '—'}</Text>
                                            <Text style={styles.category}>{variant?.name ?? entry.variantId}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.categoryChip}>{entry.item?.category ?? ''}</Text>
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                No outfits yet. Visit the Shop to buy some!
                            </Text>
                        }
                    />
                )
            )}

            <ItemDetailModal
                item={selectedItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
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
    loader: { flex: 1, justifyContent: 'center' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    thumbWrapper: { position: 'relative' },
    itemThumb: { width: 48, height: 48, borderRadius: 8 },
    thumbPlaceholder: { backgroundColor: theme.colors.border },
    countBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    countBadgeText: {
        color: theme.colors.primaryText,
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 14,
    },
    itemInfo: { flex: 1, gap: 2 },
    outfitLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    swatch: { width: 36, height: 36, borderRadius: 18 },
    name: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
    category: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
    categoryChip: {
        color: theme.colors.textMuted,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    empty: {
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
        paddingHorizontal: 24,
    },
});
