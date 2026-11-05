import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import type { PublicUser } from '@chat-app/shared-types';
import UserRow from '@/components/UserRow';
import { AppText, Button, Chip, EmptyState, Spinner, TextField } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';

interface Props {
  selected: PublicUser[];
  onChange: (selected: PublicUser[]) => void;
  /** People already in the room: shown as added, and can't be picked. */
  excludeIds?: string[];
  /** Most people that can be picked, when the room has a limit. */
  maxSelected?: number;
}

const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
  },
  chips: {
    flexGrow: 0,
    marginBottom: t.space.md,
  },
  chipsContent: {
    gap: t.space.sm,
  },
  counter: {
    marginTop: 6,
  },
  list: {
    flex: 1,
    marginTop: t.space.sm,
  },
  loader: {
    marginTop: t.space.xxl,
  },
  noFriends: {
    flex: 1,
  },
}));

/**
 * Pick several of your friends to add to a room; only friends can be added. Lists them all,
 * narrowed by typing. Picked people show as chips above the search.
 */
export default function UserPicker({ selected, onChange, excludeIds = [], maxSelected }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
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
        <EmptyState
          icon="people-outline"
          title="No friends yet"
          body="You can add your friends to rooms. Find some first!"
          action={<Button title="Find Friends" icon="person-add" onPress={() => router.push('/add-friends')} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {selected.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
          {selected.map((user) => (
            <Chip key={user._id} label={user.username} selected trailingIcon="close" onPress={() => toggle(user)} />
          ))}
        </ScrollView>
      )}

      <TextField
        leftIcon="search"
        value={input}
        onChangeText={setInput}
        placeholder="Search your friends"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {maxSelected !== undefined && (
        <AppText variant="caption" color="textSecondary" align="right" style={styles.counter}>
          {isFull ? 'Room is full' : `${selected.length}/${maxSelected} picked`}
        </AppText>
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
                  <AppText variant="label" color="textSecondary">Added</AppText>
                ) : (
                  <Ionicons
                    name={picked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={picked ? t.colors.primary : t.colors.textMuted}
                  />
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Spinner style={styles.loader} />
          ) : (
            <EmptyState icon="search-outline" title="No match" body={`No friends match "${input.trim()}".`} />
          )
        }
      />
    </View>
  );
}
