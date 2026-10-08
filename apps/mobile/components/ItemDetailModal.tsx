import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
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

interface ItemDetailModalProps {
    item: Item | null;
    visible: boolean;
    onClose: () => void;
    onBuy?: (itemId: string) => void;
    isBuying?: boolean;
    ownedCount?: number;
}

export default function ItemDetailModal({ item, visible, onClose, onBuy, isBuying, ownedCount = 0 }: ItemDetailModalProps) {
    const source = item ? resolveItemSource(item.assetUrl) : null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.dialog} onPress={() => {}}>
                    {/* Image area */}
                    {source
                        ? <Image source={source} style={styles.itemImage} contentFit="contain" />
                        : <View style={styles.imagePlaceholder} />
                    }

                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>

                    {item && (
                        <View style={styles.content}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            {item.description ? (
                                <Text style={styles.itemDescription}>{item.description}</Text>
                            ) : null}

                            {/* Metadata grid */}
                            <View style={styles.metaGrid}>
                                <View style={styles.metaRow}>
                                    <View style={styles.metaCell}>
                                        <Text style={styles.metaLabel}>Category</Text>
                                        <Text style={styles.metaValue}>{item.category}</Text>
                                    </View>
                                    <View style={styles.metaCell}>
                                        <Text style={styles.metaLabel}>Placement</Text>
                                        <Text style={styles.metaValue}>{item.placement}</Text>
                                    </View>
                                </View>
                                <View style={styles.metaRow}>
                                    <View style={styles.metaCell}>
                                        <Text style={styles.metaLabel}>Action</Text>
                                        <Text style={styles.metaValue}>{item.action}</Text>
                                    </View>
                                    <View style={styles.metaCell}>
                                        <Text style={styles.metaLabel}>Dimensions</Text>
                                        <Text style={styles.metaValue}>
                                            {item.dimensions.x} × {item.dimensions.y} × {item.dimensions.z}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Price */}
                            <Text style={styles.price}>{formatPrice(item.price)}</Text>

                            {/* Already-owned notice for canOwnMultiple items */}
                            {onBuy && item.canOwnMultiple && ownedCount > 0 && (
                                <Text style={styles.ownedNotice}>
                                    You already own {ownedCount} — buying another adds a new copy to your inventory.
                                </Text>
                            )}

                            {/* Buy button — only in shop context */}
                            {onBuy && (
                                <TouchableOpacity
                                    style={styles.buyButton}
                                    onPress={() => onBuy(item._id)}
                                    disabled={isBuying}
                                    activeOpacity={0.7}
                                >
                                    {isBuying
                                        ? <ActivityIndicator color={theme.colors.primaryText} size="small" />
                                        : <Text style={styles.buyText}>Buy — {formatPrice(item.price)}</Text>
                                    }
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    dialog: {
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: 16,
        width: '100%',
        maxWidth: 360,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: 200,
    },
    imagePlaceholder: {
        width: '100%',
        height: 200,
        backgroundColor: theme.colors.border,
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: theme.colors.text,
        fontSize: 14,
        lineHeight: 18,
    },
    content: {
        padding: 20,
        gap: 12,
    },
    itemName: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '700',
    },
    itemDescription: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    metaGrid: {
        gap: 8,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metaCell: {
        flex: 1,
    },
    metaLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metaValue: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    price: {
        color: theme.colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },
    ownedNotice: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    buyButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    buyText: {
        color: theme.colors.primaryText,
        fontWeight: '700',
        fontSize: 16,
    },
});
