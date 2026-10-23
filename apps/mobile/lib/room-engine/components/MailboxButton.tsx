import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  unread: number;
  /** A short hint beside the button, e.g. when no one else is in the room. */
  hint?: string | null;
  onPress: () => void;
}

/** Floating button that opens the room's postbox, with the unread count. */
export function MailboxButton({ unread, hint, onPress }: Readonly<Props>) {
  return (
    <View style={styles.row} pointerEvents="box-none">
      {hint ? (
        <TouchableOpacity style={styles.hint} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.hintText}>{hint}</Text>
          <View style={styles.hintArrow} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85} accessibilityLabel="Postbox">
        <Ionicons name={unread > 0 ? 'mail-unread' : 'mail'} size={24} color={theme.colors.primaryText} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  hint: {
    marginRight: 12,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  hintText: {
    color: theme.colors.text,
    fontSize: 13,
  },
  hintArrow: {
    position: 'absolute',
    right: -6,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: theme.colors.surfaceElevated,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.borderSubtle,
    transform: [{ rotate: '45deg' }],
  },
});
