import { Stack } from 'expo-router';

import { theme } from '@/constants/theme';

export default function AvatarLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
