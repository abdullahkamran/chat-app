import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import UserAvatar from '@/components/UserAvatar';
import UserPicker from '@/components/UserPicker';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { PublicUser, RoomMembers } from '@chat-app/shared-types';

/**
 * Who is in a room. Managers (the owner today) add and remove people here; members leave.
 * Opened from the room's header, as a modal over it.
 */
export default function RoomMembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { userId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [isAdding, setIsAdding] = useState(false);
  const [picked, setPicked] = useState<PublicUser[]>([]);

  const membersKey = ['roomMembers', roomId];
  const { data, isLoading, error } = useQuery({
    queryKey: membersKey,
    queryFn: () => api.get<RoomMembers>(`/api/v1/rooms/${roomId}/members`),
    enabled: !!roomId,
  });

  const showError = (e: Error) => Alert.alert('Something went wrong', e.message);

  const add = useMutation({
    mutationFn: (users: PublicUser[]) =>
      api.post(`/api/v1/rooms/${roomId}/members`, { userIds: users.map((u) => u._id) }),
    onSuccess: () => {
      setIsAdding(false);
      setPicked([]);
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (user: PublicUser) => api.delete(`/api/v1/rooms/${roomId}/members/${user._id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
    onError: showError,
  });

  const leave = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${roomId}/leave`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.dismissTo('/(tabs)');
    },
    onError: showError,
  });

  const confirmRemove = (user: PublicUser) =>
    Alert.alert(`Remove ${user.username}?`, 'They will lose access to this room.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(user) },
    ]);

  const confirmLeave = () =>
    Alert.alert('Leave this room?', "You'll need the owner to add you back.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
    ]);

  const header = (title: string, onBack: () => void, backLabel: string) => (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.headerBack}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (isLoading || !data) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        {error ? (
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        ) : (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        )}
      </View>
    );
  }

  const { owner, members, personLimit, canManageMembers } = data;
  const count = members.length + 1;
  const spaceLeft = personLimit - count;
  const isOwner = owner._id === userId;

  if (isAdding) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {header('Add People', () => { setIsAdding(false); setPicked([]); }, '‹ Back')}
        <View style={[styles.body, { paddingBottom: insets.bottom }]}>
          <UserPicker
            selected={picked}
            onChange={setPicked}
            excludeIds={[owner._id, ...members.map((m) => m._id)]}
            maxSelected={spaceLeft}
          />
          <Pressable
            style={[styles.primaryBtn, (!picked.length || add.isPending) && styles.primaryBtnDisabled]}
            onPress={() => add.mutate(picked)}
            disabled={!picked.length || add.isPending}
          >
            {add.isPending ? (
              <ActivityIndicator color={theme.colors.primaryText} />
            ) : (
              <Text style={styles.primaryBtnText}>{picked.length ? `Add ${picked.length}` : 'Add'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const memberRow = (user: PublicUser, isRoomOwner: boolean) => (
    <View style={styles.row}>
      <UserAvatar username={user.username} />
      <View style={styles.rowText}>
        <Text style={styles.username} numberOfLines={1}>
          {user.username}{user._id === userId ? ' (you)' : ''}
        </Text>
        <Text style={styles.level}>Level {user.level}</Text>
      </View>
      {isRoomOwner ? (
        <Text style={styles.ownerBadge}>Owner</Text>
      ) : canManageMembers && user._id !== userId ? (
        <Pressable onPress={() => confirmRemove(user)} hitSlop={8} accessibilityLabel={`Remove ${user.username}`}>
          <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header(`Members · ${count}/${personLimit}`, () => router.back(), '‹ Done')}
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {canManageMembers && (
          <Pressable
            style={[styles.addBtn, spaceLeft <= 0 && styles.primaryBtnDisabled]}
            onPress={() => setIsAdding(true)}
            disabled={spaceLeft <= 0}
          >
            <Ionicons name="person-add" size={18} color={theme.colors.primaryText} />
            <Text style={styles.primaryBtnText}>{spaceLeft > 0 ? 'Add People' : 'Room is full'}</Text>
          </Pressable>
        )}

        <FlatList
          data={members}
          keyExtractor={(m) => m._id}
          style={styles.list}
          ListHeaderComponent={memberRow(owner, true)}
          renderItem={({ item }) => memberRow(item, false)}
        />

        {!isOwner && (
          <Pressable style={styles.leaveBtn} onPress={confirmLeave} disabled={leave.isPending}>
            {leave.isPending ? (
              <ActivityIndicator color={theme.colors.error} />
            ) : (
              <Text style={styles.leaveText}>Leave Room</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
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
  ownerBadge: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 17,
  },
  leaveBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  leaveText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
