import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@/constants/theme';
import { ItemPlacement, type RoomItem } from '@chat-app/shared-types';

interface Props {
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  selectedPlacedItem?: RoomItem | null;
  onRemovePlacedItem?: () => void;
  onRotatePlacedItem?: () => void;
  /** Whether an inventory item is chosen for placement, for the hint. */
  isPlacing?: boolean;
  topInset?: number;
}

/** Save / Cancel bar shown at the top while in edit mode. */
export function EditModeToolbar({
  isSaving, onSave, onCancel, selectedPlacedItem, onRemovePlacedItem, onRotatePlacedItem, isPlacing = false,
  topInset = 0,
}: Props) {
  const hint = selectedPlacedItem
    ? 'Tap the floor to move it'
    : isPlacing
      ? 'Tap the floor to place'
      : 'Tap furniture to move it';
  return (
    <View style={[styles.toolbar, { paddingTop: topInset + 10 }]}>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isSaving}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        {selectedPlacedItem ? (
          <View style={styles.actions}>
            {selectedPlacedItem.itemId.placement === ItemPlacement.FLOOR && (
              <TouchableOpacity style={styles.rotateBtn} onPress={onRotatePlacedItem} disabled={isSaving}>
                <Text style={styles.rotateText}>↻ Rotate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.removeBtn} onPress={onRemovePlacedItem} disabled={isSaving}>
              <Text style={styles.removeText}>🗑 Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.label}>Edit Room</Text>
        )}
        <Text style={styles.hint}>{hint}</Text>
      </View>

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
  center: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  rotateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  rotateText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
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
