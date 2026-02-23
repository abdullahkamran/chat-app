import { Stack, useRouter } from 'expo-router';
import { Avatar } from '@chat-app/shared-types';
import AvatarEditorScreen from '@/components/AvatarEditorScreen';

export default function CreateAvatarScreen() {
  const router = useRouter();

  function handleSaved(_avatar: Avatar) {
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create Avatar' }} />
      <AvatarEditorScreen mode="create" onSaved={handleSaved} />
    </>
  );
}
