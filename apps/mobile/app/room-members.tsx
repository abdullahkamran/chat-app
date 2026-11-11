import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import UserPicker from '@/components/UserPicker';
import UserRow from '@/components/UserRow';
import { AppText, Button, IconButton, ScreenHeader, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { PublicUser, RoomLeaveResult, RoomMembers } from '@chat-app/shared-types';

/**
 * Who is in a room, owners first. Like a WhatsApp group: owners add and remove people (other owners
 * too), make members owners, dismiss owners and can delete the room; anyone can leave. The creator
 * can't be removed or dismissed. When the last owner leaves, the server picks someone at random to
 * own the room. Opened from the room's header, as a modal over it.
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
  const closeAdding = () => {
    setIsAdding(false);
    setPicked([]);
  };
  // Back from "Add People" returns to the member list, not out of the sheet.
  usePreventRemove(isAdding, closeAdding);

  const membersKey = ['roomMembers', roomId];
  const { data, isLoading, error } = useQuery({
    queryKey: membersKey,
    queryFn: () => api.get<RoomMembers>(`/api/v1/rooms/${roomId}/members`),
    enabled: !!roomId,
  });

  const showError = (e: Error) => Alert.alert('Something went wrong', e.message);
  const refetchMembers = () => queryClient.invalidateQueries({ queryKey: membersKey });
  // Out of the room: back to the room list, which no longer has it.
  const exitRoom = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    router.dismissTo('/(tabs)');
  };

  const add = useMutation({
    mutationFn: (users: PublicUser[]) =>
      api.post(`/api/v1/rooms/${roomId}/members`, { userIds: users.map((u) => u._id) }),
    onSuccess: () => {
      closeAdding();
      refetchMembers();
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (user: PublicUser) => api.delete(`/api/v1/rooms/${roomId}/members/${user._id}`),
    onSuccess: refetchMembers,
    onError: showError,
  });

  const makeOwner = useMutation({
    mutationFn: (user: PublicUser) => api.post(`/api/v1/rooms/${roomId}/owners`, { userId: user._id }),
    onSuccess: () => {
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['roomDetails', roomId] });
    },
    onError: showError,
  });

  const dismissOwner = useMutation({
    mutationFn: (user: PublicUser) => api.delete(`/api/v1/rooms/${roomId}/owners/${user._id}`),
    onSuccess: refetchMembers,
    onError: showError,
  });

  const leave = useMutation({
    mutationFn: () => api.post<RoomLeaveResult>(`/api/v1/rooms/${roomId}/leave`, {}),
    onSuccess: exitRoom,
    onError: showError,
  });

  const deleteRoom = useMutation({
    mutationFn: () => api.delete(`/api/v1/rooms/${roomId}`),
    onSuccess: exitRoom,
    onError: showError,
  });

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

  const { members, ownerIds, creatorId, personLimit, canManageMembers } = data;
  const count = members.length;
  const spaceLeft = personLimit - count;
  const isOwner = !!userId && ownerIds.includes(userId);
  const isOnlyOwner = isOwner && ownerIds.length === 1;
  const isAlone = count === 1;

  const confirmRemove = (user: PublicUser) =>
    Alert.alert(`Remove ${user.username}?`, 'They will lose access to this room.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(user) },
    ]);

  const confirmMakeOwner = (user: PublicUser) =>
    Alert.alert(
      `Make ${user.username} an owner?`,
      'Owners can add and remove people, edit the room, make others owners and delete the room.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Make Owner', onPress: () => makeOwner.mutate(user) },
      ],
    );

  const confirmDismiss = (user: PublicUser) =>
    Alert.alert(`Dismiss ${user.username} as owner?`, "They'll stay in the room as a member.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', style: 'destructive', onPress: () => dismissOwner.mutate(user) },
    ]);

  // What an owner can do to someone else: make or dismiss them as owner, or remove them.
  const showMemberActions = (user: PublicUser, isRowOwner: boolean) =>
    Alert.alert(user.username, undefined, [
      isRowOwner
        ? { text: 'Dismiss as Owner', onPress: () => confirmDismiss(user) }
        : { text: 'Make Owner', onPress: () => confirmMakeOwner(user) },
      { text: 'Remove from Room', style: 'destructive', onPress: () => confirmRemove(user) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const leaveMessage = isAlone
    ? "You're the only one here, so leaving deletes the room."
    : isOnlyOwner
      ? "You're the only owner, so someone in the room will be picked at random to own it."
      : isOwner
        ? "You'll stop being an owner. The other owners keep the room."
        : "You'll need an owner to add you back.";

  const confirmLeave = () =>
    Alert.alert('Leave this room?', leaveMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete this room?', "It's deleted for everyone, along with its postbox. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRoom.mutate() },
    ]);

  if (isAdding) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Add People" onBack={closeAdding} />
        <View style={[styles.body, { paddingBottom: insets.bottom }]}>
          <UserPicker
            selected={picked}
            onChange={setPicked}
            excludeIds={members.map((m) => m._id)}
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

  const memberRow = ({ item: user }: { item: PublicUser }) => {
    const isRowOwner = ownerIds.includes(user._id);
    // Owners manage everyone but themselves and the creator.
    const canManageRow = canManageMembers && user._id !== userId && user._id !== creatorId;
    return (
      <UserRow
        username={`${user.username}${user._id === userId ? ' (you)' : ''}`}
        subtitle={`Level ${user.level}`}
        right={
          <View style={styles.rowActions}>
            {isRowOwner && (
              <View style={styles.ownerBadge}>
                <AppText variant="overline" color="onReward">Owner</AppText>
              </View>
            )}
            {canManageRow && (
              <IconButton
                icon="ellipsis-horizontal"
                size={36}
                onPress={() => showMemberActions(user, isRowOwner)}
                accessibilityLabel={`Manage ${user.username}`}
              />
            )}
          </View>
        }
      />
    );
  };

  const busy = leave.isPending || deleteRoom.isPending;

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
          renderItem={memberRow}
        />

        {canManageMembers ? (
          <View style={styles.bottomRow}>
            <Button
              title="Leave"
              icon="exit-outline"
              variant="ghost"
              loading={leave.isPending}
              disabled={busy}
              onPress={confirmLeave}
              style={styles.rowBtn}
            />
            <Button
              title="Delete Room"
              icon="trash-outline"
              variant="danger"
              loading={deleteRoom.isPending}
              disabled={busy}
              onPress={confirmDelete}
              style={styles.rowBtn}
            />
          </View>
        ) : (
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  ownerBadge: {
    paddingHorizontal: t.space.sm,
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
  bottomRow: {
    flexDirection: 'row',
    gap: t.space.md,
    marginTop: t.space.sm,
    marginBottom: t.space.xl,
  },
  rowBtn: {
    flex: 1,
  },
}));
