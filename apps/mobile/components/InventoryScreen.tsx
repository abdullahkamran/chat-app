import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animation, AvatarItem, Item } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { AppText, Badge, EmptyState, ScreenHeader, SegmentedControl, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveAvatarSource, resolveItemSource } from '@/constants/avatarAssets';
import ItemDetailModal from './ItemDetailModal';

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

const ANIMATION_CATEGORY_LABEL: Record<string, string> = {
    EMOTE: 'Emote',
    WALK: 'Walk',
    SIT: 'Sit',
};

const useStyles = makeStyles(t => ({
    container: { flex: 1, backgroundColor: t.colors.background },
    tabSwitcher: { marginHorizontal: t.space.lg, marginBottom: t.space.md },
    loader: { flex: 1 },
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

export default function InventoryScreen(): React.JSX.Element {
    const t = useTheme();
    const styles = useStyles();
    const { userId } = useAuth();
    const insets = useSafeAreaInsets();
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
                isLoadingAnimations ? (
                    <Spinner style={styles.loader} size="large" />
                ) : (
                    <FlatList
                        data={animations}
                        keyExtractor={(a) => a._id}
                        contentContainerStyle={styles.list}
                        renderItem={({ item: anim }) => (
                            <View style={styles.row}>
                                <View style={styles.thumbTile}>
                                    <Ionicons name="musical-notes" size={22} color={t.colors.primary} />
                                </View>
                                <AppText variant="heading" style={styles.info}>{anim.name}</AppText>
                                {tag(ANIMATION_CATEGORY_LABEL[anim.category] ?? anim.category)}
                            </View>
                        )}
                        ListEmptyComponent={
                            <EmptyState icon="musical-notes-outline" title="No animations yet" body="Visit the Shop to pick up some moves!" />
                        }
                    />
                )
            ) : inventoryTab === 'items' ? (
                isLoadingItems ? (
                    <Spinner style={styles.loader} size="large" />
                ) : (
                    <FlatList
                        data={groupedItems}
                        keyExtractor={({ item }) => item._id}
                        contentContainerStyle={styles.list}
                        renderItem={({ item: { item, count } }) => {
                            const source = resolveItemSource(item.assetUrl);
                            return (
                                <Pressable
                                    style={({ pressed }) => [styles.row, pressed ? { transform: [{ translateY: t.pressDepth }] } : t.shadows.sticker]}
                                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                                >
                                    <View style={styles.thumbTile}>
                                        {source && <Image source={source} style={styles.itemThumb} contentFit="contain" />}
                                        {count > 1 && <Badge count={count} ringColor={t.colors.surface} />}
                                    </View>
                                    <View style={styles.info}>
                                        <AppText variant="heading" numberOfLines={1}>{item.name}</AppText>
                                        <AppText variant="caption" color="textSecondary">{item.category}</AppText>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={
                            <EmptyState icon="cube-outline" title="Your inventory is empty" body="Visit the Shop to find furniture for your room!" />
                        }
                    />
                )
            ) : (
                isLoadingOutfits ? (
                    <Spinner style={styles.loader} size="large" />
                ) : (
                    <FlatList
                        data={avatarInventory}
                        keyExtractor={(entry, index) => `${entry.item?._id ?? index}-${entry.variantId}`}
                        contentContainerStyle={styles.list}
                        renderItem={({ item: entry }) => {
                            const variant = entry.item?.variants?.find((v) => v._id === entry.variantId);
                            const source = resolveAvatarSource(variant?.sourceUrl ?? '');
                            return (
                                <View style={styles.row}>
                                    {source
                                        ? <Image source={source} style={styles.swatch} contentFit="contain" />
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
