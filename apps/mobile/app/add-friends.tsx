import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FriendSuggestion, IncomingFriendRequest, PublicUser, RelatedUser } from '@chat-app/shared-types';
import FriendButton from '@/components/FriendButton';
import UserRow from '@/components/UserRow';
import { theme } from '@/constants/theme';
import { useContactSync } from '@/hooks/useContactSync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useFriendActions, useFriends, useIncomingRequests, useSuggestions } from '@/hooks/useFriends';
import { useMe } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { shareInvite } from '@/utils/invite';

/** How long typing must pause before a search goes out. */
const SEARCH_DEBOUNCE_MS = 250;

type Tab = 'add' | 'friends';

/** A row on the Add Friends home: a request someone sent, or a Quick Add suggestion. */
type HomeItem =
  | { kind: 'request'; request: IncomingFriendRequest }
  | { kind: 'suggestion'; suggestion: FriendSuggestion };

/** Accept or decline a request someone sent. */
function RequestRow({ request }: Readonly<{ request: IncomingFriendRequest }>) {
  const { accept, removeRequest } = useFriendActions();
  const busy = accept.isPending || removeRequest.isPending;
  return (
    <UserRow
      username={request.user.username}
      subtitle="Added you"
      right={
        busy ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <View style={styles.rowActions}>
            <Pressable style={styles.acceptBtn} onPress={() => accept.mutate(request.user._id)}>
              <Text style={styles.acceptText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => removeRequest.mutate(request.user._id)}
              hitSlop={8}
              accessibilityLabel={`Decline ${request.user.username}`}
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        )
      }
    />
  );
}

/** Why someone is in Quick Add, strongest reason first. */
function suggestionReason(s: FriendSuggestion): string {
  if (s.inContacts) return 'In your contacts';
  if (s.mutualFriends) return `${s.mutualFriends} mutual friend${s.mutualFriends === 1 ? '' : 's'}`;
  return `In ${s.sharedRooms} room${s.sharedRooms === 1 ? '' : 's'} with you`;
}

/** Someone in Quick Add: add them, or hide them for good. */
function SuggestionRow({ suggestion }: Readonly<{ suggestion: FriendSuggestion }>) {
  const { dismiss } = useFriendActions();
  return (
    <UserRow
      username={suggestion.username}
      subtitle={suggestionReason(suggestion)}
      right={
        <View style={styles.rowActions}>
          <FriendButton userId={suggestion._id} relation={suggestion.relation} />
          <Pressable
            onPress={() => dismiss.mutate(suggestion._id)}
            disabled={dismiss.isPending}
            hitSlop={8}
            accessibilityLabel={`Hide ${suggestion.username}`}
          >
            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      }
    />
  );
}

/** A friend, with a button to unfriend them. */
function FriendRow({ friend }: Readonly<{ friend: PublicUser }>) {
  const { unfriend } = useFriendActions();
  const confirm = () =>
    Alert.alert(`Remove ${friend.username}?`, "They won't be told. Rooms you share stay as they are.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unfriend.mutate(friend._id) },
    ]);
  return (
    <UserRow
      username={friend.username}
      subtitle={`Level ${friend.level}`}
      right={
        unfriend.isPending ? (
          <ActivityIndicator color={theme.colors.error} />
        ) : (
          <Pressable onPress={confirm} hitSlop={8} accessibilityLabel={`Remove ${friend.username}`}>
            <Ionicons name="person-remove-outline" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        )
      }
    />
  );
}

/**
 * Snapchat-style Add Friends: search by username, requests people sent you, Quick Add
 * (contacts, mutual friends, shared rooms), inviting people to the app, and your friends
 * on a second tab.
 */
export default function AddFriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('add');
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);

  const friends = useFriends();
  const requests = useIncomingRequests();
  const suggestions = useSuggestions();
  const contacts = useContactSync();
  const me = useMe();
  const search = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => api.get<RelatedUser[]>(`/api/v1/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });

  const friendCount = friends.data?.length ?? 0;

  const tabButton = (value: Tab, label: string) => (
    <Pressable style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
      <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );

  const searchResults = (
    <FlatList
      data={search.data ?? []}
      keyExtractor={(u) => u._id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <UserRow
          username={item.username}
          subtitle={`Level ${item.level}`}
          right={<FriendButton userId={item._id} relation={item.relation} />}
        />
      )}
      ListEmptyComponent={
        search.isFetching ? undefined : <Text style={styles.empty}>{`No one found for "${query}".`}</Text>
      }
    />
  );

  const sections: { title: string; data: HomeItem[] }[] = [
    { title: 'Added Me', data: (requests.data ?? []).map((request) => ({ kind: 'request', request })) },
    { title: 'Quick Add', data: (suggestions.data ?? []).map((suggestion) => ({ kind: 'suggestion', suggestion })) },
  ];
  const isEmpty = sections.every((s) => s.data.length === 0);

  const home = (
    <SectionList
      sections={sections}
      keyExtractor={(item) => (item.kind === 'request' ? `r${item.request.user._id}` : `s${item.suggestion._id}`)}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) =>
        section.data.length ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
      }
      renderItem={({ item }) =>
        item.kind === 'request' ? <RequestRow request={item.request} /> : <SuggestionRow suggestion={item.suggestion} />
      }
      ListHeaderComponent={
        contacts.access === 'ask' || contacts.access === 'blocked' ? (
          <Pressable style={styles.contactsCard} onPress={contacts.allow}>
            <Ionicons name="people" size={22} color={theme.colors.primary} />
            <View style={styles.contactsText}>
              <Text style={styles.contactsTitle}>Find friends from your contacts</Text>
              <Text style={styles.contactsBody}>
                {contacts.access === 'blocked'
                  ? 'Allow contacts access in Settings.'
                  : "See who's already here. Your contacts aren't saved."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        ) : undefined
      }
      ListFooterComponent={
        <>
          {isEmpty &&
            (requests.isLoading || suggestions.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
            ) : (
              <Text style={styles.empty}>Search for friends by their username.</Text>
            ))}
          {me.data && (
            <Pressable style={styles.inviteBtn} onPress={() => shareInvite(me.data.username)}>
              <Ionicons name="share-outline" size={18} color={theme.colors.text} />
              <Text style={styles.inviteText}>Invite friends to the app</Text>
            </Pressable>
          )}
        </>
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {tabButton('add', 'Add Friends')}
        {tabButton('friends', friendCount ? `My Friends (${friendCount})` : 'My Friends')}
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {tab === 'add' ? (
          <>
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
              {search.isFetching && <ActivityIndicator size="small" color={theme.colors.primary} />}
            </View>
            {query ? searchResults : home}
          </>
        ) : (
          <FlatList
            data={friends.data ?? []}
            keyExtractor={(f) => f._id}
            renderItem={({ item }) => <FriendRow friend={item} />}
            ListEmptyComponent={
              friends.isLoading ? (
                <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
              ) : (
                <Text style={styles.empty}>No friends yet. Find people on the Add Friends tab.</Text>
              )
            }
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '600',
    width: 64,
  },
  headerTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 64,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: theme.colors.primaryText,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
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
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: theme.colors.placeholder,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 4,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  acceptBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  acceptText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
  contactsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  contactsText: {
    flex: 1,
  },
  contactsTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  contactsBody: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingVertical: 14,
    marginTop: 24,
    marginBottom: 24,
  },
  inviteText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  loader: {
    marginTop: 32,
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
});
