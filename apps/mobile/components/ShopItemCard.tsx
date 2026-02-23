import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Amount, Item } from '@chat-app/shared-types';

function formatPrice(price: Amount): string {
    const parts: string[] = [];
    if (price.realMoney > 0) parts.push(`$${price.realMoney.toFixed(2)}`);
    if (price.cash > 0) parts.push(`${price.cash} cash`);
    if (price.coins > 0) parts.push(`${price.coins} coins`);
    return parts.length > 0 ? parts.join(' + ') : 'Free';
}

interface ShopItemCardProps {
    item: Item;
    onBuy: () => void;
    isBuying: boolean;
}

export default function ShopItemCard({ item, onBuy, isBuying }: ShopItemCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </View>
            <TouchableOpacity
                style={styles.buyButton}
                onPress={onBuy}
                disabled={isBuying}
                activeOpacity={0.7}
            >
                {isBuying
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.buyText}>Buy</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#222',
    },
    info: { flex: 1, marginRight: 12 },
    name: { color: '#fff', fontSize: 16, fontWeight: '600' },
    description: { color: '#888', fontSize: 13, marginTop: 2 },
    price: { color: '#FFFC00', fontSize: 13, marginTop: 4, fontWeight: '500' },
    buyButton: {
        backgroundColor: '#FFFC00',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minWidth: 58,
        alignItems: 'center',
    },
    buyText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
