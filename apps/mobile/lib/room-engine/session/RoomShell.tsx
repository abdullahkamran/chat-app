import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { AvatarDrawer } from '../components/AvatarDrawer';
import { ChatInput } from '../components/ChatInput';
import { EmoteDrawer } from '../components/EmoteDrawer';
import { TypingIndicator } from '../components/TypingIndicator';
import { EditModeButton } from '../EditMode/EditModeButton';
import { EditModeToolbar } from '../EditMode/EditModeToolbar';
import { InventoryDrawer } from '../EditMode/InventoryDrawer';
import type { RoomSession } from './useRoomSession';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
  },
  backBtn: {
    padding: 8,
  },
  roomHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 17,
  },
  headerBtn: {
    width: 40,
    padding: 8,
    alignItems: 'center',
  },
});

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
  // One drawer at a time takes the chat input's place.
  const [drawer, setDrawer] = useState<'avatars' | 'emotes' | null>(null);
  const toggleDrawer = (next: 'avatars' | 'emotes') => setDrawer(open => (open === next ? null : next));
  const closeDrawer = () => setDrawer(null);
  const {
    roomDetails, isLoading, error, isOwner, isSaving, mode, edit, scene, typingNames, intents, canEmote, isSeated,
  } = session;
  const isEditMode = mode === 'edit';

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !roomDetails) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View>
          <Button title="Failed to load room." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        <View style={[styles.roomHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.roomHeaderTitle} numberOfLines={1}>{roomDetails.name}</Text>
          {canEmote && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => toggleDrawer('emotes')}
              accessibilityLabel="Emotes"
            >
              <Ionicons
                name={drawer === 'emotes' ? 'happy' : 'happy-outline'}
                size={22}
                color={drawer === 'emotes' ? theme.colors.primary : theme.colors.text}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => toggleDrawer('avatars')}
            accessibilityLabel="Change avatar"
          >
            <Ionicons
              name={drawer === 'avatars' ? 'shirt' : 'shirt-outline'}
              size={22}
              color={drawer === 'avatars' ? theme.colors.primary : theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {children}

        {isOwner && !isEditMode && (
          <EditModeButton onPress={intents.enterEdit} />
        )}
      </View>

      {isEditMode && (
        <InventoryDrawer selectedItem={edit.selectedItem} onSelectItem={intents.selectInventoryItem} pendingItems={scene?.items ?? []} />
      )}
      {!isEditMode && drawer === 'avatars' && <AvatarDrawer onClose={closeDrawer} />}
      {!isEditMode && drawer === 'emotes' && (
        <EmoteDrawer disabled={isSeated} onEmote={intents.emote} onClose={closeDrawer} />
      )}
      {!isEditMode && drawer === null && (
        <>
          <TypingIndicator names={typingNames} />
          <ChatInput onTyping={intents.typing} onSubmit={intents.submitMessage} />
        </>
      )}
    </View>
  );
}
