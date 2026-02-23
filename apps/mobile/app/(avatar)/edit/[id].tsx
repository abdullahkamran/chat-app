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

// Reconstruct editor selections from a populated Avatar object.
// The server filters each part's variants[] to just the selected one,
// so variants[0] is the active variant.
function avatarToSelections(avatar: Avatar) {
  const parts = ['eye', 'skin', 'mouth', 'tops', 'bottoms', 'hair', 'headwear', 'facewear', 'wristwear', 'footwear'] as const;
  const result: Partial<Record<string, { itemId: string; variantId: string }>> = {};

  for (const part of parts) {
    const item = avatar[part as keyof Avatar] as (Avatar[keyof Avatar] & { _id?: string; variants?: Array<{ _id: string }> }) | undefined;
    if (item && typeof item === 'object' && '_id' in item && item._id && item.variants?.[0]) {
      result[part] = { itemId: item._id as string, variantId: item.variants[0]._id };
    }
  }

  return result;
}

export default function EditAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['my-avatars'],
    queryFn: () => api.get<MyAvatarsResponse>('/api/v1/avatar'),
  });

  const avatar = data?.avatars.find((a) => a._id === id);
  const initialSelections = avatar ? avatarToSelections(avatar) : undefined;

  function handleSaved(_updated: Avatar) {
    router.back();
  }

  if (isLoading || !initialSelections) {
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
        initialSelections={initialSelections}
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
