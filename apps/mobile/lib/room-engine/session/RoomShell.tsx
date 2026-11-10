import { usePreventRemove, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmoteType, RoomCategory, type Animation } from '@chat-app/shared-types';
import { AppText, Button, EmptyState, IconButton, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useMailbox } from '@/hooks/useMailbox';
import { AvatarDrawer } from '../components/AvatarDrawer';
import { ChatInput } from '../components/ChatInput';
import { TranscriptButton, TranscriptPanel, TranscriptPeek } from '../components/ChatTranscript';
import { EmoteDrawer, emoteTypeOf } from '../components/EmoteDrawer';
import { EmotePrompt } from '../components/EmotePrompt';
import { MailboxModal } from '../components/MailboxModal';
import { RoomToolbar, type RoomDrawer } from '../components/RoomToolbar';
import { TypingIndicator } from '../components/TypingIndicator';
import { EditModeToolbar } from '../EditMode/EditModeToolbar';
import { InventoryDrawer } from '../EditMode/InventoryDrawer';
import { useUsernames } from '../hooks/useUsernames';
import type { RoomSession } from './useRoomSession';

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingHorizontal: t.space.sm,
    paddingBottom: t.space.sm,
    backgroundColor: t.colors.background,
    borderBottomWidth: t.borderWidth.thin,
    borderBottomColor: t.colors.border,
  },
  roomHeaderTitle: {
    flex: 1,
    marginHorizontal: t.space.xs,
  },
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  dock: {
    paddingHorizontal: t.space.sm,
    paddingBottom: t.space.sm,
  },
}));

interface Props {
  session: RoomSession;
  /** The engine's renderer. */
  children: ReactNode;
  /** The middle of the room toolbar (the experimental joystick). Hidden with the toolbar in edit mode. */
  controls?: ReactNode;
}

/**
 * Engine-independent room chrome: header or edit toolbar, the room toolbar over the chat
 * input, avatar or emote drawer or inventory drawer, and the loading / error states. The
 * engine renders in between.
 */
export function RoomShell({ session, children, controls }: Readonly<Props>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  // One drawer at a time takes the chat input's place.
  const [drawer, setDrawer] = useState<RoomDrawer | null>(null);
  const toggleDrawer = (next: RoomDrawer) => setDrawer(open => (open === next ? null : next));
  const closeDrawer = () => setDrawer(null);
  // The chrome under the header rides up with the keyboard, which covers the nav bar inset.
  // The room is shifted back down by the same amount so it stays put, keyboard over its bottom edge.
  const keyboard = useAnimatedKeyboard();
  const lift = useDerivedValue(() => Math.max(0, keyboard.height.value - insets.bottom));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }));
  const roomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const {
    roomDetails, isLoading, error, isOwner, isSaving, mode, edit, scene, typingNames, intents, canEmote,
    isAlone, userId, transcript, picking, outgoingRequest, incomingRequest, emoteNotice,
  } = session;
  const isEditMode = mode === 'edit';
  // The full transcript, in place of the peek. Tapping the room closes it.
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const names = useUsernames([
    ...transcript.filter(e => e.userId !== userId).map(e => e.userId),
    ...[outgoingRequest?.toUserId, incomingRequest?.fromUserId, emoteNotice?.userId].filter((id): id is string => !!id),
  ]);
  // A two-person emote closes the drawer, so the room is free to tap whom it is for.
  const playEmote = (emote: Animation) => {
    const type = emoteTypeOf(emote);
    if (type !== EmoteType.SOLO) closeDrawer();
    intents.emote(emote.name, type);
  };
  const showChat = !isEditMode && drawer === null;
  const [mailboxOpen, setMailboxOpen] = useState(false);
  // The empty-room hint goes once the user has opened the postbox.
  const [hintSeen, setHintSeen] = useState(false);
  const { data: mailbox } = useMailbox(roomDetails?._id);
  const openMailbox = () => {
    setMailboxOpen(true);
    setHintSeen(true);
  };
  const mailHint = isAlone && mailbox?.canPost && !hintSeen ? 'No one is here. Leave a mail' : null;
  // Back (hardware, swipe or the header arrow) closes edit mode, a drawer or the transcript
  // before it leaves the room. The mailbox is a Modal and handles back itself.
  usePreventRemove(isEditMode || drawer !== null || picking !== null || (showChat && transcriptOpen), () => {
    if (isEditMode) intents.cancelEdit();
    else if (drawer !== null) closeDrawer();
    else if (picking !== null) intents.cancelPicking();
    else setTranscriptOpen(false);
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Spinner size="large" />
      </View>
    );
  }

  if (error || !roomDetails) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't open this room"
          body="Check your connection and try again."
          action={<Button title="Go back" variant="secondary" icon="chevron-back" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {isEditMode ? (
        <EditModeToolbar
          topInset={insets.top}
          isSaving={isSaving}
          onSave={intents.saveEdit}
          onCancel={intents.cancelEdit}
          selectedPlacedItem={edit.selectedPlaced}
          onRemovePlacedItem={intents.removeSelectedPlaced}
          onRotatePlacedItem={intents.rotateSelectedPlaced}
          isPlacing={edit.selectedItem !== null}
        />
      ) : (
        <View style={[styles.roomHeader, { paddingTop: insets.top + 4 }]}>
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Back" />
          <AppText variant="heading" style={styles.roomHeaderTitle} numberOfLines={1}>{roomDetails.name}</AppText>
          {/* A personal room has no members: it's open to its owner's friends. */}
          {roomDetails.category !== RoomCategory.PERSONAL && (
            <IconButton
              icon="people-outline"
              variant="surface"
              onPress={() => router.push({ pathname: '/room-members', params: { roomId: roomDetails._id } })}
              accessibilityLabel="Members"
            />
          )}
        </View>
      )}

      <View style={styles.body}>
        <Animated.View style={[{ flex: 1 }, liftStyle]}>
          <View style={{ flex: 1 }}>
            <Animated.View style={[{ flex: 1 }, roomStyle]}>
              {children}
            </Animated.View>

            {/* While the transcript is open, a touch on the room only closes it: it never walks. */}
            {showChat && transcriptOpen && (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPressIn={() => setTranscriptOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Hide chat"
              />
            )}
            {showChat && (transcriptOpen
              ? <TranscriptPanel entries={transcript} userId={userId} names={names} />
              : <TranscriptPeek entries={transcript} userId={userId} names={names} />)}
          </View>

          {isEditMode && (
            <InventoryDrawer selectedItem={edit.selectedItem} onSelectItem={intents.selectInventoryItem} pendingItems={scene?.items ?? []} theme={scene?.theme} />
          )}
          {/* Above whichever drawer or chat input is open, so a request is seen either way. */}
          {!isEditMode && (
            <EmotePrompt
              picking={picking}
              outgoing={outgoingRequest}
              incoming={incomingRequest}
              notice={emoteNotice}
              names={names}
              isAlone={isAlone}
              onCancelPicking={intents.cancelPicking}
              onCancelRequest={intents.cancelEmoteRequest}
              onAnswer={intents.answerEmoteRequest}
            />
          )}
          {showChat && <TypingIndicator names={typingNames} />}
          {!isEditMode && (
            <RoomToolbar
              center={controls}
              drawer={drawer}
              onToggleDrawer={toggleDrawer}
              canEmote={canEmote}
              unread={mailbox?.unread ?? 0}
              mailHint={mailHint}
              onOpenMailbox={openMailbox}
              onEdit={isOwner ? intents.enterEdit : undefined}
            />
          )}
          {/* A drawer opens under the toolbar, in the chat input's place. */}
          {!isEditMode && drawer === 'avatars' && <AvatarDrawer onClose={closeDrawer} />}
          {!isEditMode && drawer === 'emotes' && <EmoteDrawer onEmote={playEmote} onClose={closeDrawer} />}
          {showChat && (
            <View style={styles.dock}>
              <ChatInput
                onTyping={intents.typing}
                onSubmit={intents.submitMessage}
                left={<TranscriptButton open={transcriptOpen} onPress={() => setTranscriptOpen(open => !open)} />}
              />
            </View>
          )}
        </Animated.View>
      </View>

      <MailboxModal room={roomDetails} userId={userId} visible={mailboxOpen} onClose={() => setMailboxOpen(false)} />
    </View>
  );
}
