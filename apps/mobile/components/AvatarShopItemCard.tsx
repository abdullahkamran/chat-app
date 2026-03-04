import React, { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { Amount, AvatarItem, AvatarItemVariant } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
import { resolveAvatarSource } from '@/constants/avatarAssets';

function formatPrice(price: Amount): string {
    const parts: string[] = [];
    if (price.realMoney > 0) parts.push(`$${price.realMoney.toFixed(2)}`);
    if (price.cash > 0) parts.push(`${price.cash} cash`);
    if (price.coins > 0) parts.push(`${price.coins} coins`);
    return parts.length > 0 ? parts.join(' + ') : 'Free';
}

interface AvatarShopItemCardProps {
    item: AvatarItem;
    ownedVariantIds: string[];
    onBuy: (itemId: string, variantId: string) => void;
    buyingKey: string | null; // `${itemId}:${variantId}` while purchase is in-flight
}

export default function AvatarShopItemCard({
    item,
    ownedVariantIds,
    onBuy,
    buyingKey,
}: AvatarShopItemCardProps) {
    const [selectedVariant, setSelectedVariant] = useState<AvatarItemVariant>(item.variants[0]);

    if (!selectedVariant) return null;

    const isOwned = ownedVariantIds.includes(selectedVariant._id);
    const isBuying = buyingKey === `${item._id}:${selectedVariant._id}`;

    return (
        <View style={styles.card}>
            {/* Item info */}
            <View style={styles.header}>
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.category}>{item.category}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.buyButton, (isOwned || isBuying) && styles.buyButtonDisabled]}
                    onPress={() => onBuy(item._id, selectedVariant._id)}
                    disabled={isOwned || isBuying}
                    activeOpacity={0.7}
                >
                    {isBuying ? (
                        <ActivityIndicator color={theme.colors.primaryText} size="small" />
                    ) : (
                        <Text style={styles.buyText}>{isOwned ? 'Owned' : 'Buy'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Variants */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.variantScroll}
                contentContainerStyle={styles.variantContent}
            >
                {item.variants.map((variant) => {
                    const isSelected = selectedVariant._id === variant._id;
                    const owned = ownedVariantIds.includes(variant._id);
                    const source = resolveAvatarSource(variant.sourceUrl);
                    return (
                        <TouchableOpacity
                            key={variant._id}
                            style={[styles.variantItem, isSelected && styles.variantItemSelected]}
                            onPress={() => setSelectedVariant(variant)}
                            activeOpacity={0.7}
                        >
                            {source
                                ? <Image source={source} style={styles.variantSwatch} contentFit="contain" />
                                : <View style={[styles.variantSwatch, { backgroundColor: variant.color ?? theme.colors.border }]} />
                            }
                            <Text style={styles.variantName} numberOfLines={1}>{variant.name}</Text>
                            {owned && <Text style={styles.ownedBadge}>✓</Text>}
                            {!owned && (
                                <Text style={styles.variantPrice} numberOfLines={1}>
                                    {formatPrice(variant.price)}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: 12,
        marginVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10,
    },
    info: { flex: 1, marginRight: 12 },
    name: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
    description: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
    category: {
        color: theme.colors.textMuted,
        fontSize: 11,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    buyButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minWidth: 64,
        alignItems: 'center',
    },
    buyButtonDisabled: {
        backgroundColor: theme.colors.border,
    },
    buyText: { color: theme.colors.primaryText, fontWeight: '700', fontSize: 14 },
    variantScroll: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    variantContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        flexDirection: 'row',
    },
    variantItem: {
        alignItems: 'center',
        padding: 8,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: theme.colors.surfaceElevated,
        minWidth: 64,
    },
    variantItemSelected: {
        borderColor: theme.colors.primary,
    },
    variantSwatch: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginBottom: 4,
    },
    variantName: {
        color: theme.colors.textSecondary,
        fontSize: 10,
        textAlign: 'center',
        maxWidth: 60,
    },
    variantPrice: {
        color: theme.colors.primary,
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
        maxWidth: 60,
    },
    ownedBadge: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
});
