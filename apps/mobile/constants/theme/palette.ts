// ---------------------------------------------------------------------------
// Raw palette: every color value in the app, by hue and step. Nothing outside
// constants/theme reads these; components use the semantic colors in themes.ts.
// ---------------------------------------------------------------------------
export const palette = {
  // Navy: backgrounds and surfaces (dark → light)
  ink: '#040810',
  navy950: '#0E1726',
  navy900: '#152238',
  navy800: '#1D2E4A',
  navy700: '#28395A',
  navy600: '#364C74',

  // Slate: secondary text and icons (light → dark)
  slate200: '#D4DEEC',
  slate300: '#A6B6CE',
  slate500: '#7085A6',
  slate600: '#56688A',

  // Frost: primary text and speech bubbles
  frost50: '#F3F7FC',

  // Mint: the brand color
  mint500: '#3DDC97',
  mint700: '#1E9A66',

  // Sky: secondary accent
  sky400: '#6CB4FF',
  sky700: '#3A77C2',

  // Gold: coins and rewards
  gold400: '#FFC94A',
  gold700: '#B8860B',

  // Red: errors and destructive actions
  red400: '#FF6B6B',
  red700: '#B33F3F',

  // Lime: success
  lime400: '#A5E86B',

  // Wood: room doors
  wood500: '#A0663A',

  // Debug overlays: loud on purpose, never in shipped UI
  debugOrange: '#FF8C1A',
  debugBlue: '#2F6BFF',

  // Pastels for letter avatars and sender names
  pastelCoral: '#FF8A6B',
  pastelPeach: '#FFB38A',
  pastelSun: '#FFD36E',
  pastelMint: '#8EE3B5',
  pastelTeal: '#5ED3C3',
  pastelSky: '#7DB8FF',
  pastelLilac: '#B79CFF',
  pastelPink: '#FF8FC7',

  // Translucent layers
  overlay: 'rgba(4,8,16,0.72)',
  scrim: 'rgba(14,23,38,0.74)',
  shadowSoft: 'rgba(4,8,16,0.45)',
  mintSoft: 'rgba(61,220,151,0.16)',
  skySoft: 'rgba(108,180,255,0.16)',
  goldSoft: 'rgba(255,201,74,0.16)',
  redSoft: 'rgba(255,107,107,0.14)',
} as const;

// ---------------------------------------------------------------------------
// Avatar art colors. The avatar art keeps its own look whatever the UI theme is,
// so these sit outside the themes: programmer-art placeholders only.
// ---------------------------------------------------------------------------
export const artPalette = {
  skin: '#E0AC69',
  hair: '#3B2A20',
  eye: '#000000',
  pieceFill: '#FFFFFF',
  pieceOutline: '#888888',
  /** Placeholder clothing, picked per user. */
  clothing: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'],
  /** Things thrown by interactive emotes, and what they leave on whoever they hit. */
  props: {
    tomato: '#E5372B',
    tomatoSplat: '#C92A1F',
    leaf: '#3E9B3A',
    snow: '#F4F8FF',
    snowShade: '#BFD3E6',
    highlight: '#FFFFFF',
  },
} as const;
