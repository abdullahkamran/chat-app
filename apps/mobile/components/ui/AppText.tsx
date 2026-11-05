import { Text, type TextProps } from 'react-native';

import { useTheme, type ThemeColors, type TypeVariant } from '@/constants/theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  /** A semantic color; defaults to the primary text color. */
  color?: keyof ThemeColors;
  align?: 'left' | 'center' | 'right';
}

/** Text in one of the theme's type styles. Use it instead of a bare <Text>. */
export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: Readonly<AppTextProps>) {
  const t = useTheme();
  return <Text style={[t.type[variant], { color: t.colors[color], textAlign: align }, style]} {...rest} />;
}
