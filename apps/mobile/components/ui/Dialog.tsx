import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';
import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** The accent behind a dialog's icon. */
export type DialogTone = 'primary' | 'secondary' | 'reward' | 'error';

const TONES = {
  primary: { bg: 'primarySoft', fg: 'primary' },
  secondary: { bg: 'secondarySoft', fg: 'secondary' },
  reward: { bg: 'rewardSoft', fg: 'reward' },
  error: { bg: 'errorSoft', fg: 'error' },
} as const;

const useStyles = makeStyles(t => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: t.space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: t.colors.surfaceElevated,
    borderRadius: t.radius.xl,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    ...t.shadows.floating,
  },
  padded: {
    padding: t.space.xl,
    alignItems: 'center',
    gap: t.space.sm,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.space.xs,
    transform: [{ rotate: '-6deg' }],
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: t.space.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: t.space.sm,
  },
  actionStack: {
    gap: t.space.sm,
  },
  rowButton: {
    flex: 1,
  },
}));

export interface DialogProps {
  visible: boolean;
  /** Called on a tap outside the card or the hardware back button, when `dismissable`. */
  onClose?: () => void;
  /** Whether a tap outside or back closes it. Default true. */
  dismissable?: boolean;
  icon?: IconName;
  tone?: DialogTone;
  title?: string;
  message?: string;
  /** Under the message, e.g. a row of Buttons. */
  actions?: ReactNode;
  /** Anything else, after the message. */
  children?: ReactNode;
  /**
   * Lay out the content yourself: no padding, no centring. For dialogs that aren't
   * icon / title / message / buttons, like an item's detail card.
   */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Changes this to pop the card in again, e.g. when the content is swapped for the next dialog. */
  popKey?: string | number;
}

/**
 * The app's dialog: a chunky sticker card that pops in over a dimmed backdrop. Tapping the
 * backdrop closes it, unless it isn't `dismissable`. For a quick confirm or notice from
 * anywhere, `showDialog()` is shorter.
 */
export function Dialog({
  visible, onClose, dismissable = true, icon, tone = 'primary', title, message, actions, children, bare = false,
  style, popKey,
}: Readonly<DialogProps>) {
  const t = useTheme();
  const styles = useStyles();
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [visible, popKey, pop]);

  const close = dismissable ? onClose : undefined;
  const toneColors = TONES[tone];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close ?? (() => {})}>
      <View style={[styles.backdrop, { backgroundColor: t.colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          disabled={!close}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          importantForAccessibility={close ? 'yes' : 'no-hide-descendants'}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            !bare && styles.padded,
            {
              opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            },
            style,
          ]}
        >
          {icon && (
            <View style={[styles.icon, { backgroundColor: t.colors[toneColors.bg] }]}>
              <Ionicons name={icon} size={32} color={t.colors[toneColors.fg]} />
            </View>
          )}
          {title ? <AppText variant="title" align="center">{title}</AppText> : null}
          {message ? <AppText color="textSecondary" align="center">{message}</AppText> : null}
          {children}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// showDialog: a themed stand-in for Alert.alert, callable from anywhere.
// ---------------------------------------------------------------------------

export interface DialogButton {
  text: string;
  /** `cancel` also runs when the dialog is dismissed by a tap outside or back. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: DialogTone;
  /** Defaults to a single "OK". */
  buttons?: DialogButton[];
  /**
   * Whether a tap outside or back closes it (running the cancel button, if any). Defaults to
   * true when there's a cancel button or only one button, so a plain notice closes easily.
   */
  dismissable?: boolean;
}

interface QueuedDialog extends DialogOptions {
  id: number;
}

type HostListener = (dialog: QueuedDialog, delayMs?: number) => void;
interface HostEntry {
  listener: HostListener;
}

/**
 * Mounted hosts, innermost last. On iOS a Modal can only present from the screen it's mounted
 * in, so each native modal screen (and any Modal that shows dialogs) mounts its own host and
 * the newest one shows them.
 */
const hosts: HostEntry[] = [];
let nextId = 1;

/** Show a themed dialog over whatever is open. Buttons work like Alert.alert's. */
export function showDialog(options: DialogOptions): void {
  const host = hosts[hosts.length - 1];
  if (!host) {
    console.warn('showDialog: no DialogHost mounted', options.title);
    return;
  }
  host.listener({ ...options, id: nextId++ });
}

/** "Something went wrong" with the error's message. */
export function showErrorDialog(error: unknown, title = 'Something went wrong'): void {
  showDialog({
    title,
    message: error instanceof Error ? error.message : 'Try again.',
    icon: 'alert-circle',
    tone: 'error',
  });
}

const BUTTON_VARIANT: Record<NonNullable<DialogButton['style']>, ButtonVariant> = {
  default: 'primary',
  destructive: 'danger',
  cancel: 'secondary',
};

/** Two short buttons sit side by side, cancel first; anything else stacks, cancel last. */
function DialogActions({ buttons, onPress }: Readonly<{ buttons: DialogButton[]; onPress: (b: DialogButton) => void }>) {
  const styles = useStyles();
  const inRow = buttons.length === 2 && buttons.every(b => b.text.length <= 12);
  if (inRow) {
    const ordered = [...buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));
    return (
      <View style={styles.actionRow}>
        {ordered.map(b => (
          <Button key={b.text} title={b.text} variant={BUTTON_VARIANT[b.style ?? 'default']} style={styles.rowButton} onPress={() => onPress(b)} />
        ))}
      </View>
    );
  }
  const ordered = [...buttons].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));
  // In a stack, only the first ordinary button is filled; the rest are quieter.
  const filled = ordered.findIndex(b => (b.style ?? 'default') === 'default');
  const variantAt = (b: DialogButton, i: number): ButtonVariant => {
    if (b.style === 'cancel') return 'ghost';
    if (b.style === 'destructive') return 'danger';
    return i === filled ? 'primary' : 'secondary';
  };
  return (
    <View style={styles.actionStack}>
      {ordered.map((b, i) => (
        <Button key={b.text} title={b.text} variant={variantAt(b, i)} fullWidth onPress={() => onPress(b)} />
      ))}
    </View>
  );
}

/**
 * Renders dialogs from `showDialog`, one at a time in order. Mount one near the root, and one
 * inside each native modal screen or Modal that can show dialogs (see `hosts`).
 */
export function DialogHost() {
  const [queue, setQueue] = useState<QueuedDialog[]>([]);
  // What's still waiting, for handing on if this host unmounts.
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const me: HostEntry = {
      listener: (dialog, delayMs) => {
        if (delayMs) timers.push(setTimeout(() => setQueue(q => [...q, dialog]), delayMs));
        else setQueue(q => [...q, dialog]);
      },
    };
    hosts.push(me);
    return () => {
      hosts.splice(hosts.indexOf(me), 1);
      timers.forEach(clearTimeout);
      // Hand anything still waiting to the host underneath, once this screen has gone.
      const below = hosts[hosts.length - 1];
      if (below) queueRef.current.forEach(d => below.listener(d, 500));
    };
  }, []);

  const current = queue[0];
  const buttons = current?.buttons?.length ? current.buttons : [{ text: 'OK' }];
  const cancel = buttons.find(b => b.style === 'cancel');
  const dismissable = current?.dismissable ?? (!!cancel || buttons.length === 1);

  const finish = (button?: DialogButton) => {
    setQueue(q => q.slice(1));
    button?.onPress?.();
  };

  return (
    <Dialog
      visible={!!current}
      popKey={current?.id}
      dismissable={dismissable}
      onClose={() => finish(cancel ?? (buttons.length === 1 ? buttons[0] : undefined))}
      icon={current?.icon}
      tone={current?.tone}
      title={current?.title}
      message={current?.message}
      actions={current && <DialogActions buttons={buttons} onPress={finish} />}
    />
  );
}
