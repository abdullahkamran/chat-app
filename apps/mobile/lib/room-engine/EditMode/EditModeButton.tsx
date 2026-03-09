import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  onPress: () => void;
}

/** Floating action button to enter edit mode. Only shown to room owners. */
export function EditModeButton({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.icon}>✏️</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  icon: {
    fontSize: 22,
  },
});
