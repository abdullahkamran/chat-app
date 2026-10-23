import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import UserRow from '@/components/UserRow';
import { theme } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';

interface Props {
  selected: PublicUser[];
  onChange: (selected: PublicUser[]) => void;
  /** People already in the room: shown as added, and can't be picked. */
  excludeIds?: string[];
  /** Most people that can be picked, when the room has a limit. */
  maxSelected?: number;
}

/**
 * Pick several of your friends to add to a room; only friends can be added. Lists them all,
 * narrowed by typing. Picked people show as chips above the search.
 */
export default function UserPicker({ selected, onChange, excludeIds = [], maxSelected }: Readonly<Props>) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const { data: friends = [], isLoading } = useFriends();

  const query = input.trim().toLowerCase();
  const shown = query ? friends.filter((f) => f.username.toLowerCase().includes(query)) : friends;

  const isFull = maxSelected !== undefined && selected.length >= maxSelected;
  const isSelected = (id: string) => selected.some((u) => u._id === id);

  const toggle = (user: PublicUser) => {
    if (isSelected(user._id)) onChange(selected.filter((u) => u._id !== user._id));
    else if (!isFull) onChange([...selected, user]);
  };

  if (!isLoading && friends.length === 0) {
    return (
      <View style={styles.noFriends}>
        <Text style={styles.empty}>{"You can add your friends to rooms. You don't have any yet."}</Text>
        <Pressable style={styles.findBtn} onPress={() => router.push('/add-friends')}>
          <Ionicons name="person-add" size={16} color={theme.colors.primaryText} />
          <Text style={styles.findText}>Find Friends</Text>
        </Pressable>
      </View>
    );
  }

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
          placeholder="Search your friends"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {maxSelected !== undefined && (
        <Text style={styles.counter}>
          {isFull ? 'Room is full' : `${selected.length}/${maxSelected} picked`}
        </Text>
      )}

      <FlatList
        data={shown}
        keyExtractor={(user) => user._id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        renderItem={({ item }) => {
          const added = excludeIds.includes(item._id);
          const picked = isSelected(item._id);
          return (
            <UserRow
              username={item.username}
              subtitle={`Level ${item.level}`}
              onPress={() => toggle(item)}
              disabled={added || (isFull && !picked)}
              right={
                added ? (
                  <Text style={styles.addedText}>Added</Text>
                ) : (
                  <Ionicons
                    name={picked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={picked ? theme.colors.primary : theme.colors.textMuted}
                  />
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>{`No friends match "${input.trim()}".`}</Text>
          )
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
  addedText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    marginTop: 32,
  },
  noFriends: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
  },
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  findText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
});
