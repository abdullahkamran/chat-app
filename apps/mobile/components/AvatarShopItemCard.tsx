import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AvatarItem, AvatarItemVariant } from '@chat-app/shared-types';
import { AppText, Button } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { resolveAvatarSource } from '@/constants/avatarAssets';
import { formatPrice } from '@/utils/formatPrice';

interface AvatarShopItemCardProps {
    item: AvatarItem;
    ownedVariantIds: string[];
    onBuy: (itemId: string, variantId: string) => void;
    buyingKey: string | null; // `${itemId}:${variantId}` while purchase is in-flight
}

const useStyles = makeStyles(t => ({
    card: {
        backgroundColor: t.colors.surface,
        marginHorizontal: t.space.lg,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        overflow: 'hidden',
        ...t.shadows.sticker,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10,
    },
    info: { flex: 1, marginRight: t.space.md, gap: 2 },
    category: { marginTop: t.space.xs },
    variantScroll: {
        borderTopWidth: t.borderWidth.thin,
        borderTopColor: t.colors.border,
    },
    variantContent: {
        paddingHorizontal: t.space.md,
        paddingVertical: 10,
        gap: t.space.sm,
        flexDirection: 'row',
    },
    variantItem: {
        alignItems: 'center',
        padding: t.space.sm,
        borderRadius: t.radius.md,
        borderWidth: t.borderWidth.thick,
        borderColor: 'transparent',
        backgroundColor: t.colors.surfaceElevated,
        minWidth: 68,
        gap: 2,
    },
    variantItemSelected: {
        borderColor: t.colors.primary,
        backgroundColor: t.colors.primarySoft,
    },
    variantSwatch: {
        width: 34,
        height: 34,
        borderRadius: t.radius.pill,
        marginBottom: 2,
    },
    variantSwatchColor: {
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.outline,
    },
    variantText: {
        maxWidth: 60,
    },
}));

export default function AvatarShopItemCard({
    item,
    ownedVariantIds,
    onBuy,
    buyingKey,
}: AvatarShopItemCardProps) {
    const t = useTheme();
    const styles = useStyles();
    const [selectedVariant, setSelectedVariant] = useState<AvatarItemVariant>(item.variants[0]);

    if (!selectedVariant) return null;

    const isOwned = ownedVariantIds.includes(selectedVariant._id);
    const isBuying = buyingKey === `${item._id}:${selectedVariant._id}`;

    return (
        <View style={styles.card}>
            {/* Item info */}
            <View style={styles.header}>
                <View style={styles.info}>
                    <AppText variant="heading" numberOfLines={1}>{item.name}</AppText>
                    <AppText variant="caption" color="textSecondary" numberOfLines={2}>{item.description}</AppText>
                    <AppText variant="overline" color="textMuted" style={styles.category}>{item.category}</AppText>
                </View>
                <Button
                    title={isOwned ? 'Owned' : 'Buy'}
                    icon={isOwned ? 'checkmark' : undefined}
                    variant={isOwned ? 'secondary' : 'reward'}
                    size="sm"
                    loading={isBuying}
                    disabled={isOwned}
                    onPress={() => onBuy(item._id, selectedVariant._id)}
                />
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
                        <Pressable
                            key={variant._id}
                            style={[styles.variantItem, isSelected && styles.variantItemSelected]}
                            onPress={() => setSelectedVariant(variant)}
                        >
                            {source
                                ? <Image source={source} style={styles.variantSwatch} contentFit="contain" />
                                : <View style={[styles.variantSwatch, styles.variantSwatchColor, { backgroundColor: variant.color ?? t.colors.border }]} />
                            }
                            <AppText variant="caption" color="textSecondary" align="center" style={styles.variantText} numberOfLines={1}>
                                {variant.name}
                            </AppText>
                            {owned ? (
                                <Ionicons name="checkmark-circle" size={14} color={t.colors.success} />
                            ) : (
                                <AppText variant="caption" color="reward" align="center" style={styles.variantText} numberOfLines={1}>
                                    {formatPrice(variant.price)}
                                </AppText>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}
