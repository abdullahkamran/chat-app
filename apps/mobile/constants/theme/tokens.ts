import type { TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Theme-independent tokens: the same in every theme. Colors live in themes.ts.
// ---------------------------------------------------------------------------

/** Spacing scale, in px. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii. Generous everywhere: the look is soft and chunky. */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const borderWidth = {
  thin: 1,
  thick: 2,
} as const;

/** Heights of buttons, inputs and icon buttons. */
export const controlHeight = {
  sm: 36,
  md: 48,
  lg: 56,
} as const;

/** Loaded in app/_layout.tsx. Custom fonts carry their weight in the family name, so never set fontWeight with them. */
export const fontFamily = {
  display: 'Fredoka_700Bold',
  displaySemiBold: 'Fredoka_600SemiBold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
} as const;

/**
 * Text styles. Fredoka (rounded, playful) for headings and buttons, Nunito (rounded,
 * easy to read) for everything else. Spread one into a style: `{ ...t.type.body, color }`.
 */
export const type = {
  display: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fontFamily.displaySemiBold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fontFamily.displaySemiBold, fontSize: 18, lineHeight: 24 },
  button: { fontFamily: fontFamily.displaySemiBold, fontSize: 16, lineHeight: 20 },
  buttonSmall: { fontFamily: fontFamily.displaySemiBold, fontSize: 14, lineHeight: 18 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.bodyExtraBold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fontFamily.bodyExtraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Animation durations, in ms. */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** How far a pressed button sinks into its shadow, in px. */
export const pressDepth = 3;
