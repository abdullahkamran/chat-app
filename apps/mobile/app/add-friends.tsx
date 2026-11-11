import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FriendSuggestion, IncomingFriendRequest, PublicUser, RelatedUser } from '@chat-app/shared-types';
import FriendButton from '@/components/FriendButton';
import UserRow from '@/components/UserRow';
import {
  AppText, Button, DialogHost, EmptyState, IconButton, ScreenHeader, SegmentedControl, Spinner, TextField, showDialog,
} from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
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
  const styles = useStyles();
  const { accept, removeRequest } = useFriendActions();
  const busy = accept.isPending || removeRequest.isPending;
  return (
    <UserRow
      username={request.user.username}
      subtitle="Added you"
      right={
        busy ? (
          <Spinner />
        ) : (
          <View style={styles.rowActions}>
            <Button title="Accept" size="sm" onPress={() => accept.mutate(request.user._id)} />
            <IconButton
              icon="close"
              size={32}
              onPress={() => removeRequest.mutate(request.user._id)}
              accessibilityLabel={`Decline ${request.user.username}`}
            />
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
  const styles = useStyles();
  const { dismiss } = useFriendActions();
  return (
    <UserRow
      username={suggestion.username}
      subtitle={suggestionReason(suggestion)}
      right={
        <View style={styles.rowActions}>
          <FriendButton userId={suggestion._id} relation={suggestion.relation} />
          <IconButton
            icon="close"
            size={32}
            onPress={() => dismiss.mutate(suggestion._id)}
            disabled={dismiss.isPending}
            accessibilityLabel={`Hide ${suggestion.username}`}
          />
        </View>
      }
    />
  );
}

/** A friend, with a button to unfriend them. */
function FriendRow({ friend }: Readonly<{ friend: PublicUser }>) {
  const { unfriend } = useFriendActions();
  const confirm = () =>
    showDialog({
      title: `Remove ${friend.username}?`,
      message: "They won't be told. Rooms you share stay as they are.",
      icon: 'person-remove',
      tone: 'error',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => unfriend.mutate(friend._id) },
      ],
    });
  return (
    <UserRow
      username={friend.username}
      subtitle={`Level ${friend.level}`}
      right={
        unfriend.isPending ? (
          <Spinner color="error" />
        ) : (
          <IconButton icon="person-remove-outline" size={36} onPress={confirm} accessibilityLabel={`Remove ${friend.username}`} />
        )
      }
    />
  );
}

/**
 * Add Friends: search by username, requests people sent you, Quick Add
 * (contacts, mutual friends, shared rooms), inviting people to the app, and your friends
 * on a second tab.
 */
export default function AddFriendsScreen() {
  const t = useTheme();
  const styles = useStyles();
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

  const tabs = [
    { value: 'add', label: 'Add Friends' },
    { value: 'friends', label: friendCount ? `My Friends (${friendCount})` : 'My Friends' },
  ] as const;

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
        search.isFetching ? undefined : <EmptyState icon="search-outline" title="No one found" body={`Nobody goes by "${query}".`} />
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
        section.data.length ? <AppText variant="overline" color="textMuted" style={styles.sectionTitle}>{section.title}</AppText> : null
      }
      renderItem={({ item }) =>
        item.kind === 'request' ? <RequestRow request={item.request} /> : <SuggestionRow suggestion={item.suggestion} />
      }
      ListHeaderComponent={
        contacts.access === 'ask' || contacts.access === 'blocked' ? (
          <Pressable style={styles.contactsCard} onPress={contacts.allow}>
            <View style={styles.contactsIcon}>
              <Ionicons name="people" size={22} color={t.colors.onSecondary} />
            </View>
            <View style={styles.contactsText}>
              <AppText variant="bodyStrong">Find friends from your contacts</AppText>
              <AppText variant="caption" color="textSecondary">
                {contacts.access === 'blocked'
                  ? 'Allow contacts access in Settings.'
                  : "See who's already here. Your contacts aren't saved."}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.colors.textSecondary} />
          </Pressable>
        ) : undefined
      }
      ListFooterComponent={
        <>
          {isEmpty &&
            (requests.isLoading || suggestions.isLoading ? (
              <Spinner style={styles.loader} />
            ) : (
              <EmptyState icon="people-outline" title="Find your people" body="Search for friends by their username." />
            ))}
          {me.data && (
            <Button
              title="Invite friends to the app"
              icon="share-outline"
              variant="secondary"
              fullWidth
              onPress={() => shareInvite(me.data.username)}
              style={styles.inviteBtn}
            />
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
      <ScreenHeader title="Friends" onBack={() => router.back()} backIcon="close" />
      <SegmentedControl options={tabs} value={tab} onChange={setTab} style={styles.tabs} />

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {tab === 'add' ? (
          <>
            <TextField
              leftIcon="search"
              value={input}
              onChangeText={setInput}
              placeholder="Search by username"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              right={search.isFetching ? <Spinner size="small" /> : undefined}
              containerStyle={styles.searchRow}
            />
            {query ? searchResults : home}
          </>
        ) : (
          <FlatList
            data={friends.data ?? []}
            keyExtractor={(f) => f._id}
            renderItem={({ item }) => <FriendRow friend={item} />}
            ListEmptyComponent={
              friends.isLoading ? (
                <Spinner style={styles.loader} />
              ) : (
                <EmptyState icon="heart-outline" title="No friends yet" body="Find people on the Add Friends tab." />
              )
            }
          />
        )}
      </View>
      {/* This screen is a native modal: dialogs shown while it's open have to present from it. */}
      <DialogHost />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  tabs: {
    marginHorizontal: t.space.xl,
    marginBottom: t.space.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: t.space.xl,
  },
  searchRow: {
    marginBottom: t.space.sm,
  },
  sectionTitle: {
    marginTop: t.space.lg,
    marginBottom: t.space.xs,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
  },
  contactsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    padding: 14,
    marginTop: t.space.sm,
    ...t.shadows.sticker,
  },
  contactsIcon: {
    width: 40,
    height: 40,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.secondary,
    transform: [{ rotate: '-6deg' }],
  },
  contactsText: {
    flex: 1,
    gap: 2,
  },
  inviteBtn: {
    marginVertical: t.space.xl,
  },
  loader: {
    marginTop: t.space.xxl,
  },
}));
