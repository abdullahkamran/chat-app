import { type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props {
  title?: string;
  body?: string;
  /** Shows a "Try again" button. It shows a spinner while `retrying`. */
  onRetry?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** What a screen or list shows when it couldn't load: why, and a way to try again. */
export function ErrorState({
  title = "Couldn't load this",
  body = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  style,
}: Readonly<Props>) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={title}
      body={body}
      style={style}
      action={onRetry ? <Button title="Try again" icon="refresh" variant="secondary" loading={retrying} onPress={onRetry} /> : undefined}
    />
  );
}
