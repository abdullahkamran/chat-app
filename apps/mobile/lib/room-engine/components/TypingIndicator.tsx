import React from 'react';
import { Text, View } from 'react-native';

interface TypingIndicatorProps {
  typingUserIds: Set<string>;
}

export function TypingIndicator({ typingUserIds }: TypingIndicatorProps) {
  if (typingUserIds.size === 0) return null;

  const list = Array.from(typingUserIds).join(', ');
  const verb = typingUserIds.size === 1 ? 'is' : 'are';

  return (
    <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
      <Text style={{ fontSize: 12, color: 'gray' }}>
        {list} {verb} typing...
      </Text>
    </View>
  );
}
