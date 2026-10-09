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
    const p = Skia.Path.Make();
    for (let gx = 0; gx < dimensions.x; gx++) {
      for (let gy = 0; gy < dimensions.y; gy++) {
        const top = gridToScreen(gx - 0.5, gy - 0.5, 0, origin);
        const right = gridToScreen(gx + 0.5, gy - 0.5, 0, origin);
        const bottom = gridToScreen(gx + 0.5, gy + 0.5, 0, origin);
        const left = gridToScreen(gx - 0.5, gy + 0.5, 0, origin);
        p.moveTo(top.x, top.y);
        p.lineTo(right.x, right.y);
        p.lineTo(bottom.x, bottom.y);
        p.lineTo(left.x, left.y);
        p.close();
      }
    }
    return p;
  }, [dimensions.x, dimensions.y, origin.x, origin.y]);

  return (
    <Group>
      <Path path={path} color={theme.colors.primary} opacity={FILL_OPACITY} />
      <Path path={path} color={theme.colors.primary} style="stroke" strokeWidth={1} />
    </Group>
  );
}
