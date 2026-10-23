import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { FriendRelation } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
import { useFriendActions } from '@/hooks/useFriends';

/**
 * The friend action for another user, by how they relate to the viewer:
 * Add, Requested (tap to cancel), Accept, or Friends.
 */
export default function FriendButton({ userId, relation }: Readonly<{ userId: string; relation: FriendRelation }>) {
  const { send, accept, removeRequest } = useFriendActions();
  const busy = send.isPending || accept.isPending || removeRequest.isPending;

  if (relation === 'friends') {
    return (
      <Pressable style={[styles.btn, styles.quiet]} disabled>
        <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />
        <Text style={styles.quietText}>Friends</Text>
      </Pressable>
    );
  }

  const isRequested = relation === 'requested';
  const onPress = () => {
    if (relation === 'none') send.mutate(userId);
    else if (relation === 'incoming') accept.mutate(userId);
    else removeRequest.mutate(userId);
  };

  return (
    <Pressable
      style={[styles.btn, isRequested ? styles.quiet : styles.loud]}
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={isRequested ? 'Cancel friend request' : undefined}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isRequested ? theme.colors.textSecondary : theme.colors.primaryText} />
      ) : isRequested ? (
        <Text style={styles.quietText}>Requested</Text>
      ) : (
        <>
          {relation === 'none' && <Ionicons name="person-add" size={14} color={theme.colors.primaryText} />}
          <Text style={styles.loudText}>{relation === 'none' ? 'Add' : 'Accept'}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 92,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  loud: {
    backgroundColor: theme.colors.primary,
  },
  loudText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
  quiet: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  quietText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
