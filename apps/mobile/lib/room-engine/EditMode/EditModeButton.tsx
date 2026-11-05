import { IconButton } from '@/components/ui';

interface Props {
  onPress: () => void;
}

/** Floating action button to enter edit mode. Only shown to room owners. The shell positions it. */
export function EditModeButton({ onPress }: Props) {
  return (
    <IconButton icon="color-wand" variant="secondary" size={52} onPress={onPress} accessibilityLabel="Decorate room" />
  );
}
