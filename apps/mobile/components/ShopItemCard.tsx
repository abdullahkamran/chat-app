import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '@chat-app/shared-types';
import { AppText } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { formatPrice } from '@/utils/formatPrice';

interface ShopItemCardProps {
    item: Item;
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
    price: { marginTop: t.space.xs },
}));

export default function ShopItemCard({ item, onPress }: ShopItemCardProps) {
    const t = useTheme();
    const styles = useStyles();
    const source = resolveItemSource(item.assetUrl);

    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed ? { transform: [{ translateY: t.pressDepth }] } : t.shadows.sticker]}
            onPress={onPress}
        >
            <View style={styles.thumbnailTile}>
                {source && <Image source={source} style={styles.thumbnail} contentFit="contain" />}
            </View>
            <View style={styles.info}>
                <AppText variant="heading" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="caption" color="textSecondary" numberOfLines={2}>{item.description}</AppText>
                <AppText variant="label" color="reward" style={styles.price}>{formatPrice(item.price)}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
        </Pressable>
    );
}
