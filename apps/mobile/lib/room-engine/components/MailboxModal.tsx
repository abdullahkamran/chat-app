import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isRoomOwner, ROOM_MAIL_MAX_LENGTH, RoomCategory, type RoomDetails, type RoomMail } from '@chat-app/shared-types';
import { AppText, DialogHost, EmptyState, IconButton, Spinner, showDialog } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useMailbox, useMailboxMutations } from '@/hooks/useMailbox';

interface Props {
  room: RoomDetails;
  userId: string;
  visible: boolean;
  onClose: () => void;
}

function timeAgo(date: Date | string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const useStyles = makeStyles(t => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: t.colors.overlay,
  },
  sheet: {
    maxHeight: '80%',
    minHeight: '45%',
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    borderWidth: t.borderWidth.thick,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.borderStrong,
    marginBottom: t.space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    paddingBottom: t.space.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
    transform: [{ rotate: '-6deg' }],
  },
  headerText: {
    flex: 1,
  },
  state: {
    marginVertical: t.space.xxl,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: t.space.md,
    gap: 10,
  },
  mail: {
    backgroundColor: t.colors.surfaceElevated,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    padding: t.space.md,
  },
  mailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    marginBottom: t.space.xs,
  },
  author: {
    flexShrink: 1,
  },
  time: {
    flex: 1,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space.sm,
    paddingTop: t.space.sm,
  },
  input: {
    ...t.type.body,
    flex: 1,
    maxHeight: 120,
    minHeight: t.controlHeight.md,
    color: t.colors.text,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    paddingHorizontal: t.space.lg,
    paddingTop: t.space.md,
    paddingBottom: t.space.md,
  },
  inputFocused: {
    borderColor: t.colors.primary,
  },
  sending: {
    width: t.controlHeight.md,
    height: t.controlHeight.md,
    justifyContent: 'center',
  },
}));

/**
 * The room's postbox: notes people left, newest first, and a box to leave one. Opening it marks
 * everything read. In a personal room the owner reads every note; a visitor sees only their own.
 */
export function MailboxModal({ room, userId, visible, onClose }: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error } = useMailbox(room._id);
  const { post, remove, markRead } = useMailboxMutations(room._id);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const isOwner = isRoomOwner(room, userId);
  const isPersonal = room.category === RoomCategory.PERSONAL;
  const unread = data?.unread ?? 0;

  // Opening the postbox reads it; mail arriving while it's open is read too.
  useEffect(() => {
    if (visible && unread > 0 && !markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, unread]);

  const subtitle = isPersonal
    ? isOwner
      ? 'Notes your friends left in your room'
      : 'Only the owner can read what you leave here'
    : 'Everyone in this room can read these';

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    post.mutate(trimmed, { onSuccess: () => setText('') });
  }

  const confirmDelete = (mail: RoomMail) =>
    showDialog({
      title: 'Delete this mail?',
      icon: 'trash',
      tone: 'error',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(mail._id) },
      ],
    });

  const renderMail = ({ item }: { item: RoomMail }) => {
    const mine = item.author._id === userId;
    return (
      <View style={styles.mail}>
        <View style={styles.mailHeader}>
          <AppText variant="label" color="primary" style={styles.author} numberOfLines={1}>
            {mine ? 'You' : item.author.username}
          </AppText>
          <AppText variant="caption" color="textMuted" style={styles.time}>{timeAgo(item.createdAt)}</AppText>
          {(mine || isOwner) && (
            <Pressable onPress={() => confirmDelete(item)} hitSlop={8} accessibilityLabel="Delete mail">
              <Ionicons name="trash-outline" size={16} color={t.colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <AppText>{item.text}</AppText>
      </View>
    );
  };

  const canSend = !!text.trim() && !post.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close postbox" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="mail" size={22} color={t.colors.primary} />
            </View>
            <View style={styles.headerText}>
              <AppText variant="title">Postbox</AppText>
              <AppText variant="caption" color="textSecondary">{subtitle}</AppText>
            </View>
            <IconButton icon="close" variant="surface" size={36} onPress={onClose} accessibilityLabel="Close" />
          </View>

          {isLoading ? (
            <Spinner style={styles.state} />
          ) : error ? (
            <AppText color="error" align="center" style={styles.state}>{(error as Error).message}</AppText>
          ) : (
            <FlatList
              data={data?.mails ?? []}
              keyExtractor={(m) => m._id}
              renderItem={renderMail}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <EmptyState
                  icon="mail-open-outline"
                  title="No mail yet"
                  body={data?.canPost ? 'Leave the first one.' : undefined}
                />
              }
            />
          )}

          {data?.canPost && (
            <View style={styles.compose}>
              <TextInput
                style={[styles.input, focused && styles.inputFocused]}
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Leave a mail…"
                placeholderTextColor={t.colors.placeholder}
                selectionColor={t.colors.primary}
                cursorColor={t.colors.primary}
                maxLength={ROOM_MAIL_MAX_LENGTH}
                multiline
              />
              {post.isPending ? (
                <View style={styles.sending}>
                  <Spinner />
                </View>
              ) : (
                <IconButton
                  icon="arrow-up"
                  variant="primary"
                  size={48}
                  onPress={send}
                  disabled={!canSend}
                  accessibilityLabel="Send mail"
                />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      {/* Dialogs over the postbox present from its Modal; it's only mounted while open. */}
      <DialogHost />
    </Modal>
  );
}
