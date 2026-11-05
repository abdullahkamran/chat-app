import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { User } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
import type { TranscriptEntry } from '../session/useRoomSession';

/** The peek shows at most this many of the latest messages... */
const PEEK_LINES = 3;
/** ...each for this long after it was sent. */
const PEEK_MS = 15000;

interface LineProps {
  entry: TranscriptEntry;
  /** The signed-in user, whose lines read "You". */
  userId: User['_id'];
  names: Record<User['_id'], string>;
}

/** A sender's color, the same on every line and every device. */
function nameColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return theme.avatarPalette[Math.abs(hash) % theme.avatarPalette.length];
}

function Line({ entry, userId, names }: Readonly<LineProps>) {
  const mine = entry.userId === userId;
  return (
    <Text style={styles.lineText}>
      <Text style={[styles.name, { color: mine ? theme.colors.primary : nameColor(entry.userId) }]}>
        {mine ? 'You' : names[entry.userId] ?? '…'}
      </Text>
      {'  '}
      {entry.text}
    </Text>
  );
}

function clockTime(at: number): string {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The latest few messages over the bottom-left of the room, each fading out PEEK_MS after
 * it was sent. Touches pass through to the room.
 */
export function TranscriptPeek({ entries, userId, names }: Readonly<{ entries: TranscriptEntry[] } & Omit<LineProps, 'entry'>>) {
  const [now, setNow] = useState(Date.now);
  const shown = entries.slice(-PEEK_LINES).filter(e => e.sentAt + PEEK_MS > now);

  // Re-render when the oldest shown line is due to go.
  const nextExpiry = shown.length ? shown[0].sentAt + PEEK_MS : null;
  useEffect(() => {
    if (nextExpiry === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  return (
    <View style={styles.peek} pointerEvents="none">
      {shown.map(e => (
        <Animated.View key={e.id} style={styles.peekLine} entering={FadeIn} exiting={FadeOut.duration(600)}>
          <Line entry={e} userId={userId} names={names} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Every message since entering, newest at the bottom, scrollable. */
export function TranscriptPanel({ entries, userId, names }: Readonly<{ entries: TranscriptEntry[] } & Omit<LineProps, 'entry'>>) {
  return (
    <Animated.View style={styles.panel} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No messages since you came in</Text>
      ) : (
        // Inverted, so it opens on the newest message and stays there as more arrive.
        <FlatList
          inverted
          data={[...entries].reverse()}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.panelContent}
          renderItem={({ item }) => (
            <View style={styles.panelRow}>
              <View style={{ flex: 1 }}>
                <Line entry={item} userId={userId} names={names} />
              </View>
              <Text style={styles.time}>{clockTime(item.sentAt)}</Text>
            </View>
          )}
        />
      )}
    </Animated.View>
  );
}

/** Opens and closes the transcript panel. */
export function TranscriptButton({ open, onPress }: Readonly<{ open: boolean; onPress: () => void }>) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} accessibilityLabel={open ? 'Hide chat' : 'Show chat'}>
      <Ionicons
        name={open ? 'chatbubbles' : 'chatbubbles-outline'}
        size={24}
        color={open ? theme.colors.primary : theme.colors.text}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  peek: {
    position: 'absolute',
    left: 8,
    // Clear of the postbox and edit buttons on the right.
    right: 88,
    bottom: 8,
    alignItems: 'flex-start',
    gap: 4,
  },
  peekLine: {
    backgroundColor: theme.colors.transcriptBackground,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lineText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  name: {
    fontWeight: '700',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: theme.colors.transcriptBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  panelContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  time: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 19,
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  button: {
    height: 48,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
