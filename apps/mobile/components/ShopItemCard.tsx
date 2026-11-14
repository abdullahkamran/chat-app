import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '@chat-app/shared-types';
import { AppText, Skeleton } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { formatPrice } from '@/utils/formatPrice';

interface ShopItemCardProps {
    item: Item;
    /** Copies the user owns, free and placed. */
    ownedCount?: number;
    onPress: () => void;
}

const useStyles = makeStyles(t => ({
    card: {
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
    thumbnailTile: {
        width: 60,
        height: 60,
        borderRadius: t.radius.md,
        backgroundColor: t.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnail: {
        width: 52,
        height: 52,
    },
    info: { flex: 1, gap: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginTop: t.space.xs },
    skeletonCard: { borderColor: t.colors.surface },
    skeletonInfo: { flex: 1, gap: t.space.sm },
}));

export default function ShopItemCard({ item, ownedCount = 0, onPress }: ShopItemCardProps) {
    const t = useTheme();
    const styles = useStyles();
    const source = resolveItemSource(item.assetUrl);

    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed ? { transform: [{ translateY: t.pressDepth }] } : t.shadows.sticker]}
            onPress={onPress}
        >
            <View style={styles.thumbnailTile}>
                {source && <Image source={source} style={styles.thumbnail} contentFit="contain" transition={t.motion.fast} />}
            </View>
            <View style={styles.info}>
                <AppText variant="heading" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="caption" color="textSecondary" numberOfLines={2}>{item.description}</AppText>
                <View style={styles.priceRow}>
                    <AppText variant="label" color="reward">{formatPrice(item.price)}</AppText>
                    {ownedCount > 0 && <AppText variant="caption" color="secondary">Owned {ownedCount}</AppText>}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
        </Pressable>
    );
}

/** A ShopItemCard-shaped placeholder while the shop loads. */
export function ShopItemCardSkeleton() {
    const styles = useStyles();
    return (
        <View style={[styles.card, styles.skeletonCard]}>
            <Skeleton width={60} height={60} radius="md" />
            <View style={styles.skeletonInfo}>
                <Skeleton width="55%" height={16} radius="xs" />
                <Skeleton width="85%" height={10} radius="xs" />
                <Skeleton width="25%" height={12} radius="xs" />
            </View>
        </View>
    );
}
