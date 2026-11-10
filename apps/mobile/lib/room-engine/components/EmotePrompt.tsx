import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText, Button, Spinner } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { EmoteType, MUTUAL_EMOTE_REQUEST_MS, type MutualEmoteRequest } from '@chat-app/shared-types';
import { INTERACTIVE_EMOTES, MUTUAL_EMOTES } from '../session/emotes';
import type { EmoteNotice, EmotePicking } from '../session/useRoomSession';
import { EMOTE_ICONS, emoteLabel } from './EmoteDrawer';

const useStyles = makeStyles(t => ({
  column: {
    gap: t.space.xs,
    paddingHorizontal: t.space.sm,
    paddingBottom: t.space.xs,
  },
  card: {
    gap: t.space.sm,
    padding: t.space.md,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceElevated,
    overflow: 'hidden',
    ...t.shadows.sticker,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  cardText: {
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: t.space.sm,
  },
  answer: {
    flex: 1,
  },
  timer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    backgroundColor: t.colors.secondary,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    paddingVertical: t.space.xs,
    paddingLeft: t.space.md,
    paddingRight: t.space.xs,
    minHeight: 44,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  pillText: {
    flex: 1,
  },
}));

interface Props {
  picking: EmotePicking | null;
  outgoing: MutualEmoteRequest | null;
  incoming: MutualEmoteRequest | null;
  notice: EmoteNotice | null;
  /** Usernames by user id; "Someone" until loaded. */
  names: Readonly<Record<string, string>>;
  /** No one else is in the room to pick. */
  isAlone: boolean;
  onCancelPicking: () => void;
  onCancelRequest: () => void;
  onAnswer: (requestId: string, accept: boolean) => void;
}

/** "high five" for a mutual emote, "throw a tomato at" for an interactive one. */
function verbOf(animation: string): string {
  return MUTUAL_EMOTES[animation]?.verb ?? INTERACTIVE_EMOTES[animation]?.verb ?? emoteLabel(animation);
}

function noticeText(n: EmoteNotice, name: string): string {
  const verb = verbOf(n.animation);
  if (n.asked) {
    switch (n.reason) {
      case 'declined': return `${name} said no to a ${verb}`;
      case 'expired': return `${name} didn't answer`;
      case 'left': return `${name} left the room`;
      case 'noRoom': return `There's no space next to ${name}`;
      default: return `The ${verb} was called off`;
    }
  }
  switch (n.reason) {
    case 'left': return `${name} left the room`;
    case 'noRoom': return `There's no space for ${name} next to you`;
    default: return `The ${verb} was called off`;
  }
}

/**
 * Two-person emote prompts, over the chat input. A request to us is a card to accept or
 * decline, with a bar running down until it lapses. Under it, one line about our own
 * side: whom to tap, the request we're waiting on, or what became of it.
 */
export function EmotePrompt({
  picking, outgoing, incoming, notice, names, isAlone, onCancelPicking, onCancelRequest, onAnswer,
}: Readonly<Props>) {
  const styles = useStyles();
  const t = useTheme();
  const nameOf = (id: string) => names[id] ?? 'Someone';

  let line: { icon: 'hand-left-outline' | 'time-outline' | 'information-circle-outline'; text: string; action?: { title: string; onPress: () => void }; busy?: boolean } | null = null;
  if (picking) {
    const verb = verbOf(picking.animation);
    line = isAlone
      ? { icon: 'information-circle-outline', text: `No one else is here to ${verb}`, action: { title: 'Cancel', onPress: onCancelPicking } }
      : {
        icon: 'hand-left-outline',
        text: `Tap someone to ${verb}`,
        action: { title: picking.type === EmoteType.INTERACTIVE ? 'Done' : 'Cancel', onPress: onCancelPicking },
      };
  } else if (outgoing) {
    line = {
      icon: 'time-outline',
      text: `Waiting for ${nameOf(outgoing.toUserId)}…`,
      action: { title: 'Cancel', onPress: onCancelRequest },
      busy: true,
    };
  } else if (notice) {
    line = { icon: 'information-circle-outline', text: noticeText(notice, nameOf(notice.userId)) };
  }

  if (!incoming && !line) return null;

  return (
    <View style={styles.column}>
      {incoming && (
        <IncomingCard key={incoming.requestId} request={incoming} name={nameOf(incoming.fromUserId)} onAnswer={onAnswer} />
      )}
      {line && (
        <View style={styles.pill}>
          {line.busy ? <Spinner size="small" /> : <Ionicons name={line.icon} size={18} color={t.colors.secondary} />}
          <AppText variant="bodyStrong" style={styles.pillText} numberOfLines={2}>{line.text}</AppText>
          {line.action && <Button title={line.action.title} variant="ghost" size="sm" onPress={line.action.onPress} />}
        </View>
      )}
    </View>
  );
}

function IncomingCard({ request, name, onAnswer }: Readonly<{
  request: MutualEmoteRequest;
  name: string;
  onAnswer: (requestId: string, accept: boolean) => void;
}>) {
  const styles = useStyles();
  const t = useTheme();
  // The time left, as a share of the full answer window, running down to zero.
  const left = useSharedValue(Math.min(1, request.expiresInMs / MUTUAL_EMOTE_REQUEST_MS));
  useEffect(() => {
    left.set(withTiming(0, { duration: request.expiresInMs, easing: Easing.linear }));
  }, [left, request.expiresInMs]);
  const timerStyle = useAnimatedStyle(() => ({ width: `${left.get() * 100}%` }));

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.iconBubble}>
          <Ionicons name={EMOTE_ICONS[request.animation] ?? 'sparkles-outline'} size={20} color={t.colors.primary} />
        </View>
        <AppText variant="bodyStrong" style={styles.cardText} numberOfLines={2}>
          {name} wants to {verbOf(request.animation)} you
        </AppText>
      </View>
      <View style={styles.buttons}>
        <Button title="Decline" variant="ghost" size="sm" onPress={() => onAnswer(request.requestId, false)} style={styles.answer} />
        <Button title="Accept" variant="primary" size="sm" icon="checkmark" onPress={() => onAnswer(request.requestId, true)} style={styles.answer} />
      </View>
      <Animated.View style={[styles.timer, timerStyle]} />
    </View>
  );
}
