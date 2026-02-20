import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { Button } from 'react-native-elements';

interface ChatInputProps {
  onTyping: () => void;
  onSubmit: (message: string) => void;
}

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    padding: 4,
  },
  chatInput: {
    flex: 1,
    zIndex: 1001,
    backgroundColor: 'grey',
    borderRadius: 25,
    color: 'white',
    fontSize: 18,
    padding: 10,
  },
  sendButton: {
    borderRadius: 24,
    backgroundColor: 'white',
    height: 48,
    width: 48,
  },
});

export function ChatInput({ onTyping, onSubmit }: Readonly<ChatInputProps>) {
  const [inputHeight, setInputHeight] = useState(42);
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

  const handleMessageChange = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(), 300);
  }, [onTyping]);

  function handleSubmit() {
    if (!message.trim()) return;
    onSubmit(message);
    setMessage('');
    Keyboard.dismiss();
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.chatInput, { height: inputHeight }]}
        multiline
        placeholder="Type a message..."
        value={message}
        onChangeText={handleMessageChange}
        onContentSizeChange={e => setInputHeight(e.nativeEvent.contentSize.height)}
      />
      <Button
        buttonStyle={styles.sendButton}
        icon={<Ionicons name="send" size={24} color="black" />}
        onPress={handleSubmit}
      />
    </View>
  );
}
