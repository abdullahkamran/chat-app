import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Avatar } from '@chat-app/shared-types';
import AvatarEditorScreen, { AvatarEditorSkeleton } from '@/components/AvatarEditorScreen';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useMyAvatars } from '@/hooks/useMyAvatars';

export default function EditAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();

  const { data, isLoading, isRefetching, refetch } = useMyAvatars();

  const avatar = data?.avatars.find((a) => a._id === id);

  function handleSaved(_updated: Avatar) {
    router.back();
  }

  if (isLoading) return <AvatarEditorSkeleton />;

  // Couldn't load the list, or the avatar was deleted elsewhere: say so instead of waiting forever.
  if (!avatar) {
    return (
      <View style={styles.centered}>
        {data ? (
          <EmptyState
            icon="help-circle-outline"
            title="Avatar not found"
            body="It may have been deleted."
            action={<Button title="Go back" variant="secondary" icon="chevron-back" onPress={() => router.back()} />}
          />
        ) : (
          <ErrorState title="Couldn't load your avatar" onRetry={() => refetch()} retrying={isRefetching} />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Avatar' }} />
      <AvatarEditorScreen
        mode="edit"
        avatarId={id}
        initialAvatar={avatar}
        onSaved={handleSaved}
      />
    </>
  );
}

const useStyles = makeStyles(t => ({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.background,
  },
}));
