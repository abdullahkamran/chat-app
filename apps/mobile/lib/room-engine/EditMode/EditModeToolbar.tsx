import { View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { ItemPlacement, type RoomItem, type RoomThemeSlot } from '@chat-app/shared-types';

interface Props {
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  selectedPlacedItem?: RoomItem | null;
  onRemovePlacedItem?: () => void;
  onRotatePlacedItem?: () => void;
  /** Whether an inventory item is chosen for placement, for the hint. */
  isPlacing?: boolean;
  /** Theme slots the selected wallpaper or flooring can go on; empty for other items. */
  themeSlots?: RoomThemeSlot[];
  onApplyTheme?: (slots: RoomThemeSlot[]) => void;
  topInset?: number;
}

const useStyles = makeStyles(t => ({
  toolbar: {
    paddingHorizontal: t.space.md,
    paddingBottom: t.space.sm + 2,
    gap: t.space.sm,
    backgroundColor: t.colors.surface,
    borderBottomWidth: t.borderWidth.thick,
    borderBottomColor: t.colors.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: t.space.sm,
  },
}));

/** Save / Cancel bar shown at the top while in edit mode, edged in the edit-mode accent. */
export function EditModeToolbar({
  isSaving, onSave, onCancel, selectedPlacedItem, onRemovePlacedItem, onRotatePlacedItem, isPlacing = false,
  themeSlots = [], onApplyTheme, topInset = 0,
}: Props) {
  const styles = useStyles();
  const isWallpaper = themeSlots.includes('leftWall');
  const isFlooring = themeSlots.includes('floor');
  const hint = selectedPlacedItem
    ? 'Tap the floor to move it'
    : isWallpaper
      ? 'Choose a wall for it'
      : isFlooring
        ? 'Lay it on the floor'
        : isPlacing
      ? 'Tap the floor to place'
      : 'Tap furniture to move it';
  return (
    <View style={[styles.toolbar, { paddingTop: topInset + 8 }]}>
      <View style={styles.row}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={isSaving} />
        <View style={styles.center}>
          <AppText variant="heading" color="secondary">Decorating</AppText>
          <AppText variant="caption" color="textSecondary">{hint}</AppText>
        </View>
        <Button title="Save" size="sm" onPress={onSave} loading={isSaving} />
      </View>

      {!selectedPlacedItem && isWallpaper && (
        <View style={styles.actions}>
          <Button title="Left wall" variant="secondary" size="sm" onPress={() => onApplyTheme?.(['leftWall'])} disabled={isSaving} />
          <Button title="Right wall" variant="secondary" size="sm" onPress={() => onApplyTheme?.(['rightWall'])} disabled={isSaving} />
          <Button title="Both" variant="secondary" size="sm" onPress={() => onApplyTheme?.(['leftWall', 'rightWall'])} disabled={isSaving} />
        </View>
      )}

      {!selectedPlacedItem && isFlooring && (
        <View style={styles.actions}>
          <Button title="Apply to floor" variant="secondary" size="sm" onPress={() => onApplyTheme?.(['floor'])} disabled={isSaving} />
        </View>
      )}

      {selectedPlacedItem && (
        <View style={styles.actions}>
          {selectedPlacedItem.itemId.placement === ItemPlacement.FLOOR && (
            <Button
              title="Rotate"
              icon="refresh"
              variant="secondary"
              size="sm"
              onPress={onRotatePlacedItem}
              disabled={isSaving}
            />
          )}
          <Button
            title="Remove"
            icon="trash-outline"
            variant="danger"
            size="sm"
            onPress={onRemovePlacedItem}
            disabled={isSaving}
          />
        </View>
      )}
    </View>
  );
}
