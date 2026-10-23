import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { PublicUser } from '@chat-app/shared-types';
import UserAvatar from '@/components/UserAvatar';
import { theme } from '@/constants/theme';
import { api } from '@/lib/api';

/** How long typing must pause before a search goes out. */
const SEARCH_DEBOUNCE_MS = 250;

interface Props {
  selected: PublicUser[];
  onChange: (selected: PublicUser[]) => void;
  /** People already in the room: shown as added, and can't be picked. */
  excludeIds?: string[];
  /** Most people that can be picked, when the room has a limit. */
  maxSelected?: number;
}

/**
 * Pick several people by searching their usernames. Picked people show as chips above the
 * search, and stay picked across searches.
 */
export default function UserPicker({ selected, onChange, excludeIds = [], maxSelected }: Readonly<Props>) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => api.get<PublicUser[]>(`/api/v1/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
    staleTime: 30_000,
  });

  const isFull = maxSelected !== undefined && selected.length >= maxSelected;
  const isSelected = (id: string) => selected.some((u) => u._id === id);

  const toggle = (user: PublicUser) => {
    if (isSelected(user._id)) onChange(selected.filter((u) => u._id !== user._id));
    else if (!isFull) onChange([...selected, user]);
  };

  return (
    <View style={styles.root}>
      {selected.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
          {selected.map((user) => (
            <Pressable key={user._id} style={styles.chip} onPress={() => toggle(user)} hitSlop={4}>
              <Text style={styles.chipText}>{user.username}</Text>
              <Ionicons name="close" size={14} color={theme.colors.primaryText} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={theme.colors.icon} />
        <TextInput
          style={styles.searchInput}
          value={input}
          onChangeText={setInput}
          placeholder="Search by username"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {isFetching && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {maxSelected !== undefined && (
        <Text style={styles.counter}>
          {isFull ? 'Room is full' : `${selected.length}/${maxSelected} picked`}
        </Text>
      )}

      <FlatList
        data={query ? results : []}
        keyExtractor={(user) => user._id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        renderItem={({ item }) => {
          const added = excludeIds.includes(item._id);
          const picked = isSelected(item._id);
          const disabled = added || (isFull && !picked);
          return (
            <Pressable
              style={[styles.row, disabled && styles.rowDisabled]}
              onPress={() => toggle(item)}
              disabled={disabled}
            >
              <UserAvatar username={item.username} />
              <View style={styles.rowText}>
                <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
                <Text style={styles.level}>Level {item.level}</Text>
              </View>
              {added ? (
                <Text style={styles.addedText}>Added</Text>
              ) : (
                <Ionicons
                  name={picked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={picked ? theme.colors.primary : theme.colors.textMuted}
                />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {!query ? 'Search for people by their username.' : isFetching ? '' : `No one found for "${query}".`}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  chips: {
    flexGrow: 0,
    marginBottom: 12,
  },
  chipsContent: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: theme.colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  counter: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  list: {
    flex: 1,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowText: {
    flex: 1,
  },
  username: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  level: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  addedText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
});
