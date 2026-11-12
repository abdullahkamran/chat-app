import { useEffect, useState } from 'react';
import { FlatList, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { User } from '@chat-app/shared-types';
import { AppText, IconButton } from '@/components/ui';
import { makeStyles, useTheme, type Theme } from '@/constants/theme';
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
  /** A sender's name was tapped. */
  onNamePress?: (userId: User['_id']) => void;
}

/** A sender's color, the same on every line and every device. */
function nameColor(t: Theme, uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return t.avatarPalette[Math.abs(hash) % t.avatarPalette.length];
}

const useStyles = makeStyles(t => ({
  peek: {
    position: 'absolute',
    left: t.space.sm,
    right: t.space.sm,
    bottom: t.space.sm,
    alignItems: 'flex-start',
    gap: t.space.xs,
  },
  peekLine: {
    backgroundColor: t.colors.transcriptBackground,
    borderRadius: t.radius.md,
    paddingHorizontal: 10,
    paddingVertical: t.space.xs,
  },
  lineText: {
    ...t.type.body,
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.text,
  },
  name: {
    fontFamily: t.fontFamily.bodyExtraBold,
  },
  panel: {
    position: 'absolute',
    left: t.space.sm,
    right: t.space.sm,
    bottom: 0,
    height: '45%',
    backgroundColor: t.colors.transcriptBackground,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  panelContent: {
    paddingHorizontal: t.space.md,
    paddingVertical: 10,
    gap: 6,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.sm,
  },
  time: {
    lineHeight: 19,
  },
  empty: {
    marginTop: t.space.xl,
  },
}));

function Line({ entry, userId, names, onNamePress }: Readonly<LineProps>) {
  const t = useTheme();
  const styles = useStyles();
  const mine = entry.userId === userId;
  return (
    <Text style={styles.lineText}>
      <Text
        style={[styles.name, { color: mine ? t.colors.primary : nameColor(t, entry.userId) }]}
        onPress={onNamePress && (() => onNamePress(entry.userId))}
        suppressHighlighting
      >
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
 * The latest few messages over the bottom of the room, just above the toolbar, each fading out PEEK_MS after
 * it was sent. Touches pass through to the room.
 */
export function TranscriptPeek({ entries, userId, names, style }: Readonly<
  { entries: TranscriptEntry[]; style?: StyleProp<ViewStyle> } & Omit<LineProps, 'entry'>
>) {
  const styles = useStyles();
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
    <View style={[styles.peek, style]} pointerEvents="none">
      {shown.map(e => (
        <Animated.View key={e.id} style={styles.peekLine} entering={FadeIn} exiting={FadeOut.duration(600)}>
          <Line entry={e} userId={userId} names={names} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Every message since entering, newest at the bottom, scrollable. Tapping a name shows that person in the room. */
export function TranscriptPanel({ entries, userId, names, onNamePress }: Readonly<{ entries: TranscriptEntry[] } & Omit<LineProps, 'entry'>>) {
  const styles = useStyles();
  return (
    <Animated.View style={styles.panel} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
      {entries.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.empty}>No messages since you came in</AppText>
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
                <Line entry={item} userId={userId} names={names} onNamePress={onNamePress} />
              </View>
              <AppText variant="caption" color="textMuted" style={styles.time}>{clockTime(item.sentAt)}</AppText>
            </View>
          )}
        />
      )}
    </Animated.View>
  );
}

/** Opens and closes the transcript panel. Sits inside the chat bar. */
export function TranscriptButton({ open, onPress }: Readonly<{ open: boolean; onPress: () => void }>) {
  return (
    <IconButton
      icon={open ? 'chatbubbles' : 'chatbubbles-outline'}
      active={open}
      onPress={onPress}
      accessibilityLabel={open ? 'Hide chat' : 'Show chat'}
    />
  );
}
