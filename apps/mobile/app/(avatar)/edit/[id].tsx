import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Avatar } from '@chat-app/shared-types';
import AvatarEditorScreen from '@/components/AvatarEditorScreen';
import { theme } from '@/constants/theme';
import { useMyAvatars } from '@/hooks/useMyAvatars';

export default function EditAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useMyAvatars();

  const avatar = data?.avatars.find((a) => a._id === id);

  function handleSaved(_updated: Avatar) {
    router.back();
  }

  if (isLoading || !avatar) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
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

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
