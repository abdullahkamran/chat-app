import { TouchableOpacity, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

interface Props {
  unread: number;
  /** A short hint over the button, e.g. when no one else is in the room. */
  hint?: string | null;
  /** Diameter in px. */
  size: number;
  onPress: () => void;
}

/** The hint's arrow, a square turned 45° so a corner points down at the button. */
const ARROW = 12;

const useStyles = makeStyles(t => ({
  anchor: {
    alignItems: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: t.space.md,
    width: 190,
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
    bottom: -ARROW / 2 - 1,
    width: ARROW,
    height: ARROW,
    backgroundColor: t.colors.surfaceElevated,
    borderBottomWidth: t.borderWidth.thick,
    borderRightWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    transform: [{ rotate: '45deg' }],
  },
}));

/** Toolbar button that opens the room's postbox, with the unread count and an optional hint above it. */
export function MailboxButton({ unread, hint, size, onPress }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <View style={styles.anchor}>
      <IconButton
        icon={unread > 0 ? 'mail-unread' : 'mail-outline'}
        variant="surface"
        size={size}
        badge={unread}
        onPress={onPress}
        accessibilityLabel="Postbox"
      />
      {hint ? (
        <TouchableOpacity style={styles.hint} onPress={onPress} activeOpacity={0.85}>
          <AppText variant="label">{hint}</AppText>
          {/* Under the button's centre: the bubble's right edge lines up with the button's. */}
          <View style={[styles.hintArrow, { right: size / 2 - ARROW / 2 }]} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
