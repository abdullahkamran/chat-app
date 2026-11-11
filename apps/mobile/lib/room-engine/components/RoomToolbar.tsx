import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { MailboxButton } from './MailboxButton';

export type RoomDrawer = 'avatars' | 'emotes';

interface Props {
  /** The middle of the bar: the joystick when it's on, else nothing. */
  center?: ReactNode;
  /** The drawer that's open, whose button shows as active. */
  drawer: RoomDrawer | null;
  onToggleDrawer: (drawer: RoomDrawer) => void;
  canEmote: boolean;
  unread: number;
  mailHint: string | null;
  onOpenMailbox: () => void;
  /** Room owners get the decorate button. */
  onEdit?: () => void;
  /** The camera is framing everyone; the button toggles it. */
  overview: boolean;
  onToggleOverview: () => void;
}

const useStyles = makeStyles(t => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space.sm,
    paddingVertical: t.space.xs,
  },
  // Equal flex on both sides keeps the centre piece in the middle of the screen.
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  center: {
    marginHorizontal: t.space.lg,
  },
}));

/**
 * The room's play-mode actions in one bar over the chat input: emotes and avatar on the
 * left, see-everyone, postbox and decorate on the right, the joystick in the middle.
 */
export function RoomToolbar({
  center, drawer, onToggleDrawer, canEmote, unread, mailHint, onOpenMailbox, onEdit, overview, onToggleOverview,
}: Readonly<Props>) {
  const t = useTheme();
  const styles = useStyles();
  const size = t.controlHeight.md;
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {canEmote && (
          <IconButton
            icon={drawer === 'emotes' ? 'happy' : 'happy-outline'}
            variant="surface"
            size={size}
            active={drawer === 'emotes'}
            onPress={() => onToggleDrawer('emotes')}
            accessibilityLabel="Emotes"
          />
        )}
        <IconButton
          icon={drawer === 'avatars' ? 'shirt' : 'shirt-outline'}
          variant="surface"
          size={size}
          active={drawer === 'avatars'}
          onPress={() => onToggleDrawer('avatars')}
          accessibilityLabel="Change avatar"
        />
      </View>
      {center ? <View style={styles.center}>{center}</View> : null}
      <View style={styles.side}>
        <IconButton
          icon={overview ? 'scan' : 'scan-outline'}
          variant="surface"
          size={size}
          active={overview}
          onPress={onToggleOverview}
          accessibilityLabel={overview ? 'Back to you' : 'See everyone'}
        />
        <MailboxButton unread={unread} hint={mailHint} size={size} onPress={onOpenMailbox} />
        {onEdit && (
          <IconButton icon="color-wand-outline" variant="surface" size={size} onPress={onEdit} accessibilityLabel="Decorate room" />
        )}
      </View>
    </View>
  );
}
