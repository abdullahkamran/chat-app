import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import type { Dimensions } from '@chat-app/shared-types';

const FILL_OPACITY = 0.08;

interface Props {
  dimensions: Dimensions;
  origin: GridOrigin;
}

/**
 * Edit-mode grid: one diamond per cell, as a single path.
 * Cells are centred on grid vertices, matching the legacy GridOverlay and item anchoring.
 */
export function EditGrid({ dimensions, origin }: Props) {
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let gx = 0; gx < dimensions.x; gx++) {
      for (let gy = 0; gy < dimensions.y; gy++) {
        builder.addPoly([
          gridToScreen(gx - 0.5, gy - 0.5, 0, origin),
          gridToScreen(gx + 0.5, gy - 0.5, 0, origin),
          gridToScreen(gx + 0.5, gy + 0.5, 0, origin),
          gridToScreen(gx - 0.5, gy + 0.5, 0, origin),
        ], true);
      }
    }
    return builder.build();
  }, [dimensions.x, dimensions.y, origin]);

  return (
    <Group>
      <Path path={path} color={theme.colors.primary} opacity={FILL_OPACITY} />
      <Path path={path} color={theme.colors.primary} style="stroke" strokeWidth={1} />
    </Group>
  );
}
