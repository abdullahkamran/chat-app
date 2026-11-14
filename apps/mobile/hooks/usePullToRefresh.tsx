import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useTheme } from '@/constants/theme';

/**
 * A themed pull-to-refresh control for a list. It spins only for a pull the user made, not
 * for background refetches, and keeps the data on screen meanwhile. Pass the queries'
 * `refetch` (or one function that refetches several).
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={t.colors.primary}
      colors={[t.colors.primary]}
      progressBackgroundColor={t.colors.surfaceElevated}
    />
  );
}
