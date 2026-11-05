import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import UserPicker from '@/components/UserPicker';
import UserRow from '@/components/UserRow';
import { AppText, Button, IconButton, ScreenHeader, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
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
  const styles = useStyles();
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

  if (isLoading || !data) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        {error ? (
          <AppText color="error" align="center">{(error as Error).message}</AppText>
        ) : (
          <Spinner size="large" />
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
        <ScreenHeader title="Add People" onBack={() => { setIsAdding(false); setPicked([]); }} />
        <View style={[styles.body, { paddingBottom: insets.bottom }]}>
          <UserPicker
            selected={picked}
            onChange={setPicked}
            excludeIds={[owner._id, ...members.map((m) => m._id)]}
            maxSelected={spaceLeft}
          />
          <Button
            title={picked.length ? `Add ${picked.length}` : 'Add'}
            size="lg"
            fullWidth
            loading={add.isPending}
            disabled={!picked.length}
            onPress={() => add.mutate(picked)}
            style={styles.bottomBtn}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  const memberRow = (user: PublicUser, isRoomOwner: boolean) => (
    <UserRow
      username={`${user.username}${user._id === userId ? ' (you)' : ''}`}
      subtitle={`Level ${user.level}`}
      right={
        isRoomOwner ? (
          <View style={styles.ownerBadge}>
            <AppText variant="overline" color="onReward">Owner</AppText>
          </View>
        ) : canManageMembers && user._id !== userId ? (
          <IconButton icon="person-remove-outline" size={36} onPress={() => confirmRemove(user)} accessibilityLabel={`Remove ${user.username}`} />
        ) : null
      }
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={`Members · ${count}/${personLimit}`} onBack={() => router.back()} backIcon="close" />
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {canManageMembers && (
          <Button
            title={spaceLeft > 0 ? 'Add People' : 'Room is full'}
            icon="person-add"
            fullWidth
            disabled={spaceLeft <= 0}
            onPress={() => setIsAdding(true)}
            style={styles.addBtn}
          />
        )}

        <FlatList
          data={members}
          keyExtractor={(m) => m._id}
          style={styles.list}
          ListHeaderComponent={memberRow(owner, true)}
          renderItem={({ item }) => memberRow(item, false)}
        />

        {!isOwner && (
          <Button
            title="Leave Room"
            icon="exit-outline"
            variant="danger"
            fullWidth
            loading={leave.isPending}
            onPress={confirmLeave}
            style={styles.bottomBtn}
          />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: t.space.xl,
    paddingTop: t.space.md,
  },
  list: {
    flex: 1,
  },
  ownerBadge: {
    paddingHorizontal: 10,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.reward,
  },
  addBtn: {
    marginBottom: t.space.md,
  },
  bottomBtn: {
    marginTop: t.space.sm,
    marginBottom: t.space.xl,
  },
}));
