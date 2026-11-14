import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Button, IconButton, Skeleton, SkeletonGroup } from '@/components/ui';
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
  skeletonRow: {
    flexDirection: 'row',
    gap: t.space.sm + 2,
    paddingBottom: t.space.xs,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.md,
    paddingVertical: t.space.sm,
  },
  errorText: {
    flex: 1,
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

/** A row of card placeholders in a drawer, sized like its cards, while they load. */
export function DrawerCardsSkeleton({ cardHeight, count = 4 }: Readonly<{ cardHeight: number; count?: number }>) {
  const styles = useStyles();
  return (
    <SkeletonGroup style={styles.skeletonRow}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} width={76} height={cardHeight} radius="md" />)}
    </SkeletonGroup>
  );
}

/** A drawer's contents couldn't load: say so, with a way to try again. */
export function DrawerError({ text, onRetry, retrying }: Readonly<{ text: string; onRetry: () => void; retrying: boolean }>) {
  const styles = useStyles();
  return (
    <View style={styles.error}>
      <AppText variant="caption" color="textSecondary" style={styles.errorText}>{text}</AppText>
      <Button title="Try again" size="sm" variant="secondary" loading={retrying} onPress={onRetry} />
    </View>
  );
}
