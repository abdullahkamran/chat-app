import { Stack } from 'expo-router';

export default function AvatarLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#FFFC00',
        headerTitleStyle: { color: '#fff', fontWeight: '700' },
        contentStyle: { backgroundColor: '#000' },
      }}
    />
  );
}
