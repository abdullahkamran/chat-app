import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Raw palette — all color values in one place. Change here, changes everywhere.
// ---------------------------------------------------------------------------
export const palette = {
  // Brand
  yellow: '#FFFC00',
  black: '#000000',
  white: '#FFFFFF',

  // Dark surfaces (light → dark)
  surface100: '#111111',
  surface200: '#1a1a1a',
  surface300: '#222222',
  surface400: '#333333',
  surface500: '#444444',

  // Neutral text / icons
  neutral400: '#555555',
  neutral500: '#666666',
  neutral600: '#888888',
  neutral700: '#aaaaaa',
  neutral800: '#cccccc',

  // Status
  error: '#ff4d4d',

  // Overlay
  overlay: 'rgba(0,0,0,0.75)',

  // Avatar accent palette (used for auto-generated avatar backgrounds)
  avatarRed: '#FF6B6B',
  avatarTeal: '#4ECDC4',
  avatarBlue: '#45B7D1',
  avatarGreen: '#96CEB4',
  avatarYellow: '#FFEAA7',
  avatarPlum: '#DDA0DD',
  avatarMint: '#98D8C8',

  // Placeholder avatar (Skia engine programmer art, until real wearables exist)
  avatarSkin: '#E0AC69',
  avatarHair: '#3B2A20',
} as const;

// ---------------------------------------------------------------------------
// Semantic theme — use these tokens in components, not the palette directly.
// Switching to a light theme (or any other brand) only requires updating here.
// ---------------------------------------------------------------------------
export const theme = {
  colors: {
    // Backgrounds
    background: palette.black,
    surface: palette.surface100,
    surfaceElevated: palette.surface200,
    border: palette.surface300,
    borderSubtle: palette.surface400,

    // Text
    text: palette.white,
    textSecondary: palette.neutral600,
    textMuted: palette.neutral400,
    textDisabled: palette.neutral500,
    placeholder: palette.neutral700,

    // Brand / interactive
    primary: palette.yellow,
    primaryText: palette.black,   // text on top of a yellow background

    // Status
    error: palette.error,

    // Misc
    overlay: palette.overlay,
    icon: palette.neutral600,
    tabBar: palette.black,
    tabIconDefault: palette.neutral600,
    tabIconSelected: palette.yellow,

    // Placeholder avatar parts (Skia room engine programmer art)
    avatarPlaceholderSkin: palette.avatarSkin,
    avatarPlaceholderHair: palette.avatarHair,
  },

  // Avatar accent palette exposed as an ordered array for easy indexing
  avatarPalette: [
    palette.avatarRed,
    palette.avatarTeal,
    palette.avatarBlue,
    palette.avatarGreen,
    palette.avatarYellow,
    palette.avatarPlum,
    palette.avatarMint,
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// Legacy Colors export — keeps existing themed-text / themed-view hooks working.
// ---------------------------------------------------------------------------
export const Colors = {
  light: {
    text: theme.colors.text,
    background: theme.colors.background,
    tint: theme.colors.primary,
    icon: theme.colors.icon,
    tabIconDefault: theme.colors.tabIconDefault,
    tabIconSelected: theme.colors.tabIconSelected,
  },
  dark: {
    text: theme.colors.text,
    background: theme.colors.background,
    tint: theme.colors.primary,
    icon: theme.colors.icon,
    tabIconDefault: theme.colors.tabIconDefault,
    tabIconSelected: theme.colors.tabIconSelected,
  },
};

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
