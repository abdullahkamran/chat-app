import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

import { useTheme, type ThemeColors } from '@/constants/theme';

/** A loading spinner in a theme color (primary by default). */
export function Spinner({ color = 'primary', ...rest }: Readonly<Omit<ActivityIndicatorProps, 'color'> & { color?: keyof ThemeColors }>) {
  const t = useTheme();
  return <ActivityIndicator color={t.colors[color]} {...rest} />;
}
