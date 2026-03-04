import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Amount, Item } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';

function formatPrice(price: Amount): string {
    const parts: string[] = [];
    if (price.realMoney > 0) parts.push(`$${price.realMoney.toFixed(2)}`);
    if (price.cash > 0) parts.push(`${price.cash} cash`);
    if (price.coins > 0) parts.push(`${price.coins} coins`);
    return parts.length > 0 ? parts.join(' + ') : 'Free';
}

interface ShopItemCardProps {
    item: Item;
    onPress: () => void;
}

export default function ShopItemCard({ item, onPress }: ShopItemCardProps) {
    const source = resolveItemSource(item.assetUrl);

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            {source
                ? <Image source={source} style={styles.thumbnail} contentFit="contain" />
                : <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
            }
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    thumbnailPlaceholder: {
        backgroundColor: theme.colors.border,
    },
    info: { flex: 1 },
    name: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
    description: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
    price: { color: theme.colors.primary, fontSize: 13, marginTop: 4, fontWeight: '500' },
    chevron: { color: theme.colors.textMuted, fontSize: 20 },
});
