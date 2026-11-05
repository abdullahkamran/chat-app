import React from 'react';

import type { FriendRelation } from '@chat-app/shared-types';
import { Button } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useFriendActions } from '@/hooks/useFriends';

const useStyles = makeStyles(() => ({
  btn: {
    minWidth: 104,
  },
}));

/**
 * The friend action for another user, by how they relate to the viewer:
 * Add, Requested (tap to cancel), Accept, or Friends.
 */
export default function FriendButton({ userId, relation }: Readonly<{ userId: string; relation: FriendRelation }>) {
  const styles = useStyles();
  const { send, accept, removeRequest } = useFriendActions();
  const busy = send.isPending || accept.isPending || removeRequest.isPending;

  if (relation === 'friends') {
    return <Button title="Friends" icon="checkmark" variant="secondary" size="sm" disabled style={styles.btn} />;
  }

  const isRequested = relation === 'requested';
  const onPress = () => {
    if (relation === 'none') send.mutate(userId);
    else if (relation === 'incoming') accept.mutate(userId);
    else removeRequest.mutate(userId);
  };

  return (
    <Button
      title={isRequested ? 'Requested' : relation === 'none' ? 'Add' : 'Accept'}
      icon={relation === 'none' ? 'person-add' : undefined}
      variant={isRequested ? 'secondary' : 'primary'}
      size="sm"
      loading={busy}
      onPress={onPress}
      style={styles.btn}
      accessibilityLabel={isRequested ? 'Cancel friend request' : undefined}
    />
  );
}
