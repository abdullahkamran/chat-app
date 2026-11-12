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
  // A drop target: something dragged can be let go over it.
  target: {
    borderColor: t.colors.secondary,
  },
  targetOver: {
    borderColor: t.colors.secondary,
    backgroundColor: t.colors.secondarySoft,
  },
}));

interface Props {
  title: string;
  onClose?: () => void;
  /** Shown under the content, e.g. where to get more. */
  footer?: string;
  /** Edged as a drop target while something can be dropped on it, filled while it's over it. */
  dropTarget?: 'ready' | 'over' | null;
  children: ReactNode;
}

/** The bottom drawers in a room (avatars, emotes, inventory): a rounded sheet with a title row. */
export function Drawer({ title, onClose, footer, dropTarget, children }: Readonly<Props>) {
  const styles = useStyles();
  return (
    <View style={[styles.drawer, dropTarget === 'ready' && styles.target, dropTarget === 'over' && styles.targetOver]}>
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
