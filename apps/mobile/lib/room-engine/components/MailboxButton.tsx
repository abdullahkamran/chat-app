import { TouchableOpacity, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

interface Props {
  unread: number;
  /** A short hint beside the button, e.g. when no one else is in the room. */
  hint?: string | null;
  onPress: () => void;
}

const useStyles = makeStyles(t => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hint: {
    marginRight: t.space.md,
    maxWidth: 190,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.sm,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    ...t.shadows.sticker,
  },
  hintArrow: {
    position: 'absolute',
    right: -7,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: t.colors.surfaceElevated,
    borderTopWidth: t.borderWidth.thick,
    borderRightWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    transform: [{ rotate: '45deg' }],
  },
}));

/** Floating button that opens the room's postbox, with the unread count. */
export function MailboxButton({ unread, hint, onPress }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <View style={styles.row} pointerEvents="box-none">
      {hint ? (
        <TouchableOpacity style={styles.hint} onPress={onPress} activeOpacity={0.85}>
          <AppText variant="label">{hint}</AppText>
          <View style={styles.hintArrow} />
        </TouchableOpacity>
      ) : null}
      <IconButton
        icon={unread > 0 ? 'mail-unread' : 'mail'}
        variant="primary"
        size={52}
        badge={unread}
        onPress={onPress}
        accessibilityLabel="Postbox"
      />
    </View>
  );
}
