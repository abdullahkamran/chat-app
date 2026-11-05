import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';

const useStyles = makeStyles(t => ({
  drawer: {
    backgroundColor: t.colors.surface,
    paddingTop: t.space.md,
    paddingBottom: t.space.sm,
    paddingHorizontal: t.space.lg,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    borderWidth: t.borderWidth.thick,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.space.md,
    minHeight: 32,
  },
  footer: {
    marginTop: t.space.sm,
  },
}));

interface Props {
  title: string;
  onClose?: () => void;
  /** Shown under the content, e.g. where to get more. */
  footer?: string;
  children: ReactNode;
}

/** The bottom drawers in a room (avatars, emotes, inventory): a rounded sheet with a title row. */
export function Drawer({ title, onClose, footer, children }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <View style={styles.drawer}>
      <View style={styles.titleRow}>
        <AppText variant="heading">{title}</AppText>
        {onClose && (
          <IconButton
            icon="close"
            size={32}
            variant="surface"
            onPress={onClose}
            accessibilityLabel={`Close ${title.toLowerCase()}`}
          />
        )}
      </View>
      {children}
      {footer ? <AppText variant="caption" color="textMuted" style={styles.footer}>{footer}</AppText> : null}
    </View>
  );
}
