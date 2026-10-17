import type { SkImage, SkRect } from '@shopify/react-native-skia';

/** Which avatar colour tints a programmer-art piece. */
export type TintGroup = 'skin' | 'tops' | 'bottoms' | 'footwear' | 'hair';

/**
 * What the UI thread needs to draw one view, in draw order. `srcMirror` holds the
 * horizontally flipped sprites for the west-facing pair (RSXform can't flip).
 */
export interface ViewDrawList {
  bone: number[];
  /** Per sprite; only read when the art is `tinted`. */
  tint: TintGroup[];
  src: SkRect[];
  srcMirror: SkRect[];
  pivotX: number[];
  pivotXMirror: number[];
  pivotY: number[];
  pivotYMirror: number[];
}

/** One atlas holding every sprite an avatar draws, for both views and both sides. */
export interface AvatarArt {
  image: SkImage;
  /** Atlas pixels per content pixel. */
  scale: number;
  /** True for programmer art, drawn white and tinted per actor; dressed avatars come pre-coloured. */
  tinted: boolean;
  views: Record<'front' | 'back', ViewDrawList>;
}
