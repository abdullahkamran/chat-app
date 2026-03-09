import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@/constants/theme';
import type { RoomItem } from '@chat-app/shared-types';

interface Props {
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  selectedPlacedItem?: RoomItem | null;
  onRemovePlacedItem?: () => void;
  topInset?: number;
}

/** Save / Cancel bar shown at the top while in edit mode. */
export function EditModeToolbar({ isSaving, onSave, onCancel, selectedPlacedItem, onRemovePlacedItem, topInset = 0 }: Props) {
  return (
    <View style={[styles.toolbar, { paddingTop: topInset + 10 }]}>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isSaving}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {selectedPlacedItem ? (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemovePlacedItem} disabled={isSaving}>
          <Text style={styles.removeText}>🗑 Remove</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.label}>Edit Room</Text>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={isSaving}>
        {isSaving
          ? <ActivityIndicator size="small" color={theme.colors.primaryText} />
          : <Text style={styles.saveText}>Save</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  removeText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
});
