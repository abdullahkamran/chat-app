import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { ChatInput } from '../components/ChatInput';
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
  headerSpacer: {
    width: 40,
  },
});

interface Props {
  session: RoomSession;
  /** The engine's renderer. */
  children: ReactNode;
}

/**
 * Engine-independent room chrome: header or edit toolbar, chat input or
 * inventory drawer, and the loading / error states. The engine renders in between.
 */
export function RoomShell({ session, children }: Readonly<Props>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomDetails, isLoading, error, isOwner, isSaving, mode, edit, scene, typingUserIds, intents } = session;
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
        />
      ) : (
        <View style={[styles.roomHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.roomHeaderTitle} numberOfLines={1}>{roomDetails.name}</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {children}

        {isOwner && !isEditMode && (
          <EditModeButton onPress={intents.enterEdit} />
        )}
      </View>

      {isEditMode
        ? <InventoryDrawer selectedItem={edit.selectedItem} onSelectItem={intents.selectInventoryItem} pendingItems={scene?.items ?? []} />
        : (
          <>
            <TypingIndicator typingUserIds={typingUserIds} />
            <ChatInput onTyping={intents.sendTyping} onSubmit={intents.submitMessage} />
          </>
        )
      }
    </View>
  );
}
