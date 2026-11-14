import type { SkImage, SkRect } from '@shopify/react-native-skia';

/**
 * What the UI thread needs to draw one view, in draw order. `srcMirror` holds the
 * horizontally flipped sprites for the west-facing pair (RSXform can't flip).
 */
export interface ViewDrawList {
  bone: number[];
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
  /**
   * True for the loading ghost: a white silhouette, tinted with the pulsing ghost colour
   * as it's drawn. Dressed avatars come pre-coloured.
   */
  ghost: boolean;
  views: Record<'front' | 'back', ViewDrawList>;
}
