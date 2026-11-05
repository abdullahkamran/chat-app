import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const useStyles = makeStyles(t => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: t.controlHeight.md,
    paddingHorizontal: t.space.lg,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceSunken,
  },
  focused: {
    borderColor: t.colors.primary,
  },
  large: {
    minHeight: t.controlHeight.lg,
  },
  input: {
    ...t.type.body,
    flex: 1,
    color: t.colors.text,
    paddingVertical: t.space.md,
  },
  inputLarge: {
    ...t.type.heading,
  },
}));

export interface TextFieldProps extends TextInputProps {
  leftIcon?: IconName;
  /** Anything after the input, e.g. a spinner or a show-password button. */
  right?: ReactNode;
  size?: 'md' | 'lg';
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A themed text input on a sunken, rounded field that lights up while focused. */
export function TextField({
  leftIcon, right, size = 'md', containerStyle, style, onFocus, onBlur, ref, ...rest
}: Readonly<TextFieldProps>) {
  const t = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, size === 'lg' && styles.large, focused && styles.focused, containerStyle]}>
      {leftIcon && <Ionicons name={leftIcon} size={18} color={focused ? t.colors.primary : t.colors.icon} />}
      <TextInput
        ref={ref}
        style={[styles.input, size === 'lg' && styles.inputLarge, style]}
        placeholderTextColor={t.colors.placeholder}
        selectionColor={t.colors.primary}
        cursorColor={t.colors.primary}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {right}
    </View>
  );
}
