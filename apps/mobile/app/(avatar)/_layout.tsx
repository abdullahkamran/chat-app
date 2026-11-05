import { Stack } from 'expo-router';

import { useTheme } from '@/constants/theme';

export default function AvatarLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.background },
        headerTintColor: t.colors.primary,
        headerTitleStyle: { ...t.type.heading, color: t.colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.colors.background },
      }}
    />
  );
}
