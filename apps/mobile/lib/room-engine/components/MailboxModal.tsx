import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROOM_MAIL_MAX_LENGTH, RoomCategory, type RoomDetails, type RoomMail } from '@chat-app/shared-types';
import { theme } from '@/constants/theme';
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

/**
 * The room's postbox: notes people left, newest first, and a box to leave one. Opening it marks
 * everything read. In a personal room the owner reads every note; a visitor sees only their own.
 */
export function MailboxModal({ room, userId, visible, onClose }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, error } = useMailbox(room._id);
  const { post, remove, markRead } = useMailboxMutations(room._id);
  const [text, setText] = useState('');

  const isOwner = room.ownerId === userId;
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
    Alert.alert('Delete this mail?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(mail._id) },
    ]);

  const renderMail = ({ item }: { item: RoomMail }) => {
    const mine = item.author._id === userId;
    return (
      <View style={styles.mail}>
        <View style={styles.mailHeader}>
          <Text style={styles.author} numberOfLines={1}>{mine ? 'You' : item.author.username}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          {(mine || isOwner) && (
            <Pressable onPress={() => confirmDelete(item)} hitSlop={8} accessibilityLabel="Delete mail">
              <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Text style={styles.mailText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close postbox" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <Ionicons name="mail" size={22} color={theme.colors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Postbox</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.state} color={theme.colors.primary} />
          ) : error ? (
            <Text style={[styles.state, styles.errorText]}>{(error as Error).message}</Text>
          ) : (
            <FlatList
              data={data?.mails ?? []}
              keyExtractor={(m) => m._id}
              renderItem={renderMail}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {data?.canPost ? 'No mail yet. Leave the first one.' : 'No mail yet.'}
                </Text>
              }
            />
          )}

          {data?.canPost && (
            <View style={styles.compose}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Leave a mail…"
                placeholderTextColor={theme.colors.placeholder}
                maxLength={ROOM_MAIL_MAX_LENGTH}
                multiline
              />
              <Pressable
                style={[styles.sendBtn, (!text.trim() || post.isPending) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!text.trim() || post.isPending}
                accessibilityLabel="Send mail"
              >
                {post.isPending ? (
                  <ActivityIndicator color={theme.colors.primaryText} />
                ) : (
                  <Ionicons name="send" size={18} color={theme.colors.primaryText} />
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    maxHeight: '80%',
    minHeight: '45%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  state: {
    marginVertical: 32,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 12,
    gap: 10,
  },
  empty: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginVertical: 32,
  },
  mail: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
  },
  mailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  author: {
    flexShrink: 1,
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  time: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  mailText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
