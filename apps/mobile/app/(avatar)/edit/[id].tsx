import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@chat-app/shared-types';
import { api } from '@/lib/api';
import AvatarEditorScreen from '@/components/AvatarEditorScreen';

interface MyAvatarsResponse {
  avatars: Avatar[];
  selectedAvatar: string | null;
}

export default function EditAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['my-avatars'],
    queryFn: () => api.get<MyAvatarsResponse>('/api/v1/avatar'),
  });

  const avatar = data?.avatars.find((a) => a._id === id);

  function handleSaved(_updated: Avatar) {
    router.back();
  }

  if (isLoading || !avatar) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#FFFC00" size="large" />
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
    backgroundColor: '#000',
  },
});
