import { Ionicons } from '@expo/vector-icons';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';
import { AppText } from './AppText';

const useStyles = makeStyles(t => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs + 2,
    height: t.controlHeight.sm,
    paddingLeft: t.space.xs,
    paddingRight: t.space.md,
    borderRadius: t.radius.pill,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.reward,
    backgroundColor: t.colors.rewardSoft,
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.reward,
  },
}));

/** A coin balance, e.g. in the Shop header. */
export function CoinPill({ coins, style }: Readonly<{ coins: number; style?: StyleProp<ViewStyle> }>) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.pill, style]} accessibilityLabel={`${coins} coins`}>
      <View style={styles.coin}>
        <Ionicons name="star" size={13} color={t.colors.onReward} />
      </View>
      <AppText variant="bodyStrong" color="reward">{coins.toLocaleString()}</AppText>
    </View>
  );
}
