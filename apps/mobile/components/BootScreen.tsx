import { useEffect } from 'react';
import { Image, View } from 'react-native';

import { AppText, Button, Spinner } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

/** How often to try signing back in again on its own while the server can't be reached. */
const AUTO_RETRY_MS = 3000;

const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.lg,
    paddingHorizontal: t.space.xl,
    backgroundColor: t.colors.background,
  },
  // Same size as the native splash image (app.json), so the hand-off doesn't jump.
  logo: { width: 200, height: 200 },
  message: { alignItems: 'center', gap: t.space.xs },
}));

interface Props {
  /** Signing in couldn't reach the server: say so and offer a retry. */
  failed?: boolean;
  onRetry?: () => void;
}

/** What the app shows while it starts up and signs you back in, in place of a blank screen. */
export function BootScreen({ failed = false, onRetry }: Readonly<Props>) {
  const styles = useStyles();

  useEffect(() => {
    if (!failed || !onRetry) return;
    const timer = setTimeout(onRetry, AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed, onRetry]);

  return (
    <View style={styles.root}>
      <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      {failed ? (
        <>
          <View style={styles.message}>
            <AppText variant="heading" align="center">Can't reach the server</AppText>
            <AppText color="textSecondary" align="center">Trying again…</AppText>
          </View>
          {onRetry ? <Button title="Retry now" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
        </>
      ) : (
        <Spinner size="large" />
      )}
    </View>
  );
}
