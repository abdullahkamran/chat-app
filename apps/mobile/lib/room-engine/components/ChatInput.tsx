import { useCallback, useState, type ReactNode } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';

/** The input grows with the message up to about four lines, then scrolls. */
const MIN_INPUT_H = 40;
const MAX_INPUT_H = 104;

interface ChatInputProps {
  onTyping: () => void;
  onSubmit: (message: string) => void;
  /** A button inside the bar, before the input. */
  left?: ReactNode;
}

const useStyles = makeStyles(t => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space.xs,
    padding: t.space.xs,
    borderRadius: t.radius.xl,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.floating,
  },
  barFocused: {
    borderColor: t.colors.primary,
  },
  input: {
    ...t.type.body,
    flex: 1,
    color: t.colors.text,
    paddingHorizontal: t.space.sm,
    paddingTop: 10,
    paddingBottom: 10,
  },
}));

export function ChatInput({ onTyping, onSubmit, left }: Readonly<ChatInputProps>) {
  const t = useTheme();
  const styles = useStyles();
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_H);
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const canSend = message.trim().length > 0;

  // Every keystroke reports typing; the session shows it at once and throttles what it sends.
  const handleMessageChange = useCallback((text: string) => {
    setMessage(text);
    if (text.trim()) onTyping();
  }, [onTyping]);

  function handleSubmit() {
    if (!canSend) return;
    onSubmit(message);
    setMessage('');
    Keyboard.dismiss();
  }

  return (
    <View style={[styles.bar, focused && styles.barFocused]}>
      {left}
      <TextInput
        style={[styles.input, { height: Math.min(MAX_INPUT_H, Math.max(MIN_INPUT_H, inputHeight)) }]}
        multiline
        // Multiline keeps long messages wrapping, but Enter sends instead of adding a newline.
        submitBehavior="submit"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        placeholder="Say something…"
        placeholderTextColor={t.colors.placeholder}
        selectionColor={t.colors.primary}
        cursorColor={t.colors.primary}
        value={message}
        onChangeText={handleMessageChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onContentSizeChange={e => setInputHeight(e.nativeEvent.contentSize.height)}
      />
      <IconButton
        icon="arrow-up"
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSend}
        accessibilityLabel="Send"
      />
    </View>
  );
}
