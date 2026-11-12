import { View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import type { EditDrag } from '../core/contract';

interface Props {
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Whether a placed item is picked up, its menu open over it, for the hint. */
  hasPickedUp?: boolean;
  /** Whether an inventory item is chosen for placement, for the hint. */
  isPlacing?: boolean;
  /** An item being dragged, for the hint. */
  drag?: EditDrag | null;
  topInset?: number;
}

const useStyles = makeStyles(t => ({
  toolbar: {
    paddingHorizontal: t.space.md,
    paddingBottom: t.space.sm + 2,
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
}));

function dragHint(drag: EditDrag): string {
  if (drag.over === 'away') return drag.source === 'placed' ? 'Let go to put it away' : 'Drag it onto the room';
  if (drag.over === 'room') return drag.valid ? 'Let go to place it' : "It doesn't fit here";
  return drag.source === 'placed' ? 'Let go to put it back' : 'Drag it onto the room';
}

/**
 * Save / Cancel bar shown at the top while in edit mode, edged in the edit-mode accent.
 * Always one row high, so the room under it never moves: a picked-up item's actions are in
 * its menu in the room (ItemMenu).
 */
export function EditModeToolbar({
  isSaving, onSave, onCancel, hasPickedUp = false, isPlacing = false, drag = null, topInset = 0,
}: Props) {
  const styles = useStyles();
  const hint = drag
    ? dragHint(drag)
    : hasPickedUp
      ? 'Tap anywhere to close'
      : isPlacing
        ? 'Tap to place, or drag it into the room'
        : 'Hold furniture to move it, or hold still for options';
  return (
    <View style={[styles.toolbar, { paddingTop: topInset + 8 }]}>
      <View style={styles.row}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={isSaving} />
        <View style={styles.center}>
          <AppText variant="heading" color="secondary">Decorating</AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>{hint}</AppText>
        </View>
        <Button title="Save" size="sm" onPress={onSave} loading={isSaving} disabled={!!drag} />
      </View>
    </View>
  );
}
