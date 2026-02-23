import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Item } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';

export default function InventoryScreen(): React.JSX.Element {
    const { userId } = useAuth();

    const { data: items = [], isLoading } = useQuery<Item[]>({
        queryKey: ['inventory'],
        queryFn: () => api.get<Item[]>('/api/v1/inventory'),
        enabled: !!userId,
    });

    return (
        <View style={styles.container}>
            {isLoading ? (
                <ActivityIndicator style={styles.loader} size="large" color="#FFFC00" />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.category}>{item.category}</Text>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.empty}>
                            Your inventory is empty. Visit the Shop to buy items!
                        </Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loader: { flex: 1, justifyContent: 'center' },
    row: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#222',
    },
    name: { color: '#fff', fontSize: 16, fontWeight: '600' },
    category: { color: '#888', fontSize: 13, marginTop: 2 },
    empty: {
        color: '#555',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
        paddingHorizontal: 24,
    },
});
