import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Avatar } from '@chat-app/shared-types';
import AvatarEditorScreen from '@/components/AvatarEditorScreen';
import { Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useMyAvatars } from '@/hooks/useMyAvatars';

export default function EditAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();

  const { data, isLoading } = useMyAvatars();

  const avatar = data?.avatars.find((a) => a._id === id);

  function handleSaved(_updated: Avatar) {
    router.back();
  }

  if (isLoading || !avatar) {
    return (
      <View style={styles.loader}>
        <Spinner size="large" />
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.background,
  },
}));
