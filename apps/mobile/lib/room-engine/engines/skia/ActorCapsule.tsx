import { Circle, Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import { gridToScreen, type GridOrigin } from '@/constants/grid';
import { theme } from '@/constants/theme';
import { Facing } from '@chat-app/shared-types';
import type { ActorState } from '../../core/contract';
import type { ActorMotion } from './actorMotion';

/** Placeholder body size in content pixels. Feet sit on the actor's grid position. */
export const CAPSULE_W = 24;
export const CAPSULE_H = 56;
const SHADOW_W = 30;
const SHADOW_H = 10;
const SHADOW_OPACITY = 0.35;
const FACING_DOT_R = 3;

/** Unit screen-space offset toward the facing, so a placeholder still shows which way it looks. */
const FACING_OFFSET: Record<Facing, { x: number; y: number }> = {
  [Facing.SE]: { x: 1, y: 1 },
  [Facing.SW]: { x: -1, y: 1 },
  [Facing.NE]: { x: 1, y: -1 },
  [Facing.NW]: { x: -1, y: -1 },
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  actor: ActorState;
  motion: ActorMotion;
  origin: GridOrigin;
  isLocal: boolean;
}

/**
 * Phase 1 placeholder avatar: a coloured capsule with a ground shadow and a facing dot.
 * Its position is read from the actor's shared values, so walking never re-renders React.
 */
export function ActorCapsule({ actor, motion, origin, isLocal }: Props) {
  const color = theme.avatarPalette[hashId(actor.id) % theme.avatarPalette.length];
  const facing = FACING_OFFSET[actor.facing];

  const transform = useDerivedValue(() => {
    const feet = gridToScreen(motion.gx.get(), motion.gy.get(), 0, origin);
    return [{ translateX: feet.x }, { translateY: feet.y }];
  });

  return (
    <Group transform={transform}>
      <Oval
        x={-SHADOW_W / 2}
        y={-SHADOW_H / 2}
        width={SHADOW_W}
        height={SHADOW_H}
        color={theme.colors.background}
        opacity={SHADOW_OPACITY}
      />
      <RoundedRect
        x={-CAPSULE_W / 2}
        y={-CAPSULE_H}
        width={CAPSULE_W}
        height={CAPSULE_H}
        r={CAPSULE_W / 2}
        color={color}
      />
      {isLocal && (
        <RoundedRect
          x={-CAPSULE_W / 2}
          y={-CAPSULE_H}
          width={CAPSULE_W}
          height={CAPSULE_H}
          r={CAPSULE_W / 2}
          color={theme.colors.primary}
          style="stroke"
          strokeWidth={2}
        />
      )}
      <Circle
        cx={facing.x * (CAPSULE_W / 2 - FACING_DOT_R)}
        cy={-CAPSULE_H + CAPSULE_W / 2 + facing.y * FACING_DOT_R}
        r={FACING_DOT_R}
        color={theme.colors.primaryText}
      />
    </Group>
  );
}
