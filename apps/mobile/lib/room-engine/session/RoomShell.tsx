import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoomCategory } from '@chat-app/shared-types';
import { AppText, Button, EmptyState, IconButton, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useMailbox } from '@/hooks/useMailbox';
import { AvatarDrawer } from '../components/AvatarDrawer';
import { ChatInput } from '../components/ChatInput';
import { TranscriptButton, TranscriptPanel, TranscriptPeek } from '../components/ChatTranscript';
import { EmoteDrawer } from '../components/EmoteDrawer';
import { MailboxButton } from '../components/MailboxButton';
import { MailboxModal } from '../components/MailboxModal';
import { TypingIndicator } from '../components/TypingIndicator';
import { EditModeButton } from '../EditMode/EditModeButton';
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
  fabColumn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    left: 20,
    alignItems: 'flex-end',
    gap: t.space.md,
  },
  dock: {
    paddingHorizontal: t.space.sm,
    paddingTop: t.space.xs,
    paddingBottom: t.space.sm,
  },
}));

interface Props {
  session: RoomSession;
  /** The engine's renderer. */
  children: ReactNode;
}

/**
 * Engine-independent room chrome: header or edit toolbar, chat input, avatar or emote
 * drawer or inventory drawer, and the loading / error states. The engine renders in between.
 */
export function RoomShell({ session, children }: Readonly<Props>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  // One drawer at a time takes the chat input's place.
  const [drawer, setDrawer] = useState<'avatars' | 'emotes' | null>(null);
  const toggleDrawer = (next: 'avatars' | 'emotes') => setDrawer(open => (open === next ? null : next));
  const closeDrawer = () => setDrawer(null);
  // The bottom chrome clears the system nav bar, except while the keyboard covers it.
  const keyboardOpen = useKeyboardOpen();
  const bottomInset = keyboardOpen ? 0 : insets.bottom;
  const {
    roomDetails, isLoading, error, isOwner, isSaving, mode, edit, scene, typingNames, intents, canEmote, isSeated,
    isAlone, userId, transcript,
  } = session;
  const isEditMode = mode === 'edit';
  // The full transcript, in place of the peek. Tapping the room closes it.
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const names = useUsernames(transcript.filter(e => e.userId !== userId).map(e => e.userId));
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
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
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
          {canEmote && (
            <IconButton
              icon={drawer === 'emotes' ? 'happy' : 'happy-outline'}
              variant="surface"
              active={drawer === 'emotes'}
              onPress={() => toggleDrawer('emotes')}
              accessibilityLabel="Emotes"
            />
          )}
          <IconButton
            icon={drawer === 'avatars' ? 'shirt' : 'shirt-outline'}
            variant="surface"
            active={drawer === 'avatars'}
            onPress={() => toggleDrawer('avatars')}
            accessibilityLabel="Change avatar"
          />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {/* onTouchStart sees the touch without taking it from the room. */}
        <View style={{ flex: 1 }} onTouchStart={transcriptOpen ? () => setTranscriptOpen(false) : undefined}>
          {children}
        </View>

        {!isEditMode && !(showChat && transcriptOpen) && (
          <View style={styles.fabColumn} pointerEvents="box-none">
            <MailboxButton unread={mailbox?.unread ?? 0} hint={mailHint} onPress={openMailbox} />
            {isOwner && <EditModeButton onPress={intents.enterEdit} />}
          </View>
        )}

        {showChat && (transcriptOpen
          ? <TranscriptPanel entries={transcript} userId={userId} names={names} />
          : <TranscriptPeek entries={transcript} userId={userId} names={names} />)}
      </View>

      <MailboxModal room={roomDetails} userId={userId} visible={mailboxOpen} onClose={() => setMailboxOpen(false)} />

      {isEditMode && (
        <InventoryDrawer selectedItem={edit.selectedItem} onSelectItem={intents.selectInventoryItem} pendingItems={scene?.items ?? []} />
      )}
      {!isEditMode && drawer === 'avatars' && <AvatarDrawer onClose={closeDrawer} />}
      {!isEditMode && drawer === 'emotes' && (
        <EmoteDrawer disabled={isSeated} onEmote={intents.emote} onClose={closeDrawer} />
      )}
      {showChat && (
        <>
          <TypingIndicator names={typingNames} />
          <View style={styles.dock}>
            <ChatInput
              onTyping={intents.typing}
              onSubmit={intents.submitMessage}
              left={<TranscriptButton open={transcriptOpen} onPress={() => setTranscriptOpen(open => !open)} />}
            />
          </View>
        </>
      )}
    </View>
  );
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
