import type { ViewStyle } from 'react-native';

import { palette } from './palette';
import { borderWidth, controlHeight, fontFamily, motion, pressDepth, radius, space, type } from './tokens';

/**
 * Semantic colors: what a color is for, never what it looks like. Every theme fills in
 * every key, so a component written against these works in any theme.
 */
export interface ThemeColors {
  // Backgrounds
  background: string;       // screen background
  surface: string;          // cards, drawers, bottom sheets, tab bar
  surfaceElevated: string;  // dialogs, chips and tiles on a surface
  surfaceSunken: string;    // text inputs
  border: string;           // dividers, card edges
  borderStrong: string;     // input edges, unselected outlines
  outline: string;          // the ink edge and drop of sticker-style elements

  // Text
  text: string;
  textSecondary: string;    // subtitles, labels
  textSubtle: string;       // small light labels, e.g. item names in grids
  textMuted: string;        // hints, empty states
  textDisabled: string;
  placeholder: string;

  // Brand / interactive
  primary: string;          // main buttons, active states, loaders
  primaryDeep: string;      // the drop under a primary button
  primarySoft: string;      // tinted backgrounds behind primary content
  onPrimary: string;        // text and icons on primary
  secondary: string;        // second accent (sky): edit mode, highlights
  secondaryDeep: string;
  secondarySoft: string;
  onSecondary: string;
  reward: string;           // coins, prices, levels
  rewardDeep: string;
  rewardSoft: string;
  onReward: string;

  // Status
  error: string;            // error text, destructive actions
  errorDeep: string;
  errorSoft: string;
  onError: string;
  success: string;

  // Misc
  overlay: string;          // modal backdrops
  icon: string;
  tabBar: string;
  tabIconDefault: string;
  tabIconSelected: string;
  switchTrackOff: string;
  switchThumb: string;

  // Room
  bubble: string;           // speech bubbles: light, so they read over any floor
  bubbleText: string;
  bubbleTyping: string;
  transcriptBackground: string; // see-through, so the room stays visible behind it
  roomShadow: string;
  roomLocalActor: string;   // the ring under your own avatar
  roomDoorEntry: string;    // the mat on the floor in front of the entry door
  roomDoor: string;         // the mat in front of any other door
  roomDoorWood: string;     // every door's leaf
  roomDoorWoodDeep: string; // its casing, step and plank seams
  roomDoorWoodLight: string; // the lit edge down the leaf
  roomDoorGlint: string;    // shine on the knob
  roomDoorStroke: string;   // a door's ink outline, frame and panel lines
  roomDoorKnob: string;
  roomEditGrid: string;
  roomItemSelected: string;   // edit mode: tint over the picked-up item's art
  roomDropTarget: string;     // edit mode: cells a dragged item can be dropped on
  roomDropBlocked: string;    // edit mode: cells it can't
  roomDebugGrid: string;      // dev overlay: every floor and wall cell
  roomDebugItemCell: string;  // dev overlay: cells a placed item occupies
  roomDebugActorCell: string; // dev overlay: the cell an avatar stands on
}

/** Elevation styles. Sticker shadows are hard-edged drops, not soft blurs. */
export interface ThemeShadows {
  /** Cards and tiles that sit on the page. */
  sticker: ViewStyle;
  /** Floating buttons and toasts over content. */
  floating: ViewStyle;
}

export interface Theme {
  name: string;
  /** Whether the theme is dark or light, for the status bar and system UI. */
  scheme: 'dark' | 'light';
  colors: ThemeColors;
  shadows: ThemeShadows;
  /** Accent colors for letter avatars and sender names, in a fixed order. */
  avatarPalette: readonly string[];
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  controlHeight: typeof controlHeight;
  fontFamily: typeof fontFamily;
  type: typeof type;
  motion: typeof motion;
  pressDepth: number;
}

const tokens = { space, radius, borderWidth, controlHeight, fontFamily, type, motion, pressDepth };

/** "Tide": mint green and sky blue on deep navy, with gold for rewards. Cozy, playful, fun. */
export const darkTheme: Theme = {
  name: 'dark',
  scheme: 'dark',
  colors: {
    background: palette.navy950,
    surface: palette.navy900,
    surfaceElevated: palette.navy800,
    surfaceSunken: palette.ink,
    border: palette.navy700,
    borderStrong: palette.navy600,
    outline: palette.ink,

    text: palette.frost50,
    textSecondary: palette.slate300,
    textSubtle: palette.slate200,
    textMuted: palette.slate500,
    textDisabled: palette.slate600,
    placeholder: palette.slate500,

    primary: palette.mint500,
    primaryDeep: palette.mint700,
    primarySoft: palette.mintSoft,
    onPrimary: palette.navy950,
    secondary: palette.sky400,
    secondaryDeep: palette.sky700,
    secondarySoft: palette.skySoft,
    onSecondary: palette.navy950,
    reward: palette.gold400,
    rewardDeep: palette.gold700,
    rewardSoft: palette.goldSoft,
    onReward: palette.navy950,

    error: palette.red400,
    errorDeep: palette.red700,
    errorSoft: palette.redSoft,
    onError: palette.navy950,
    success: palette.lime400,

    overlay: palette.overlay,
    icon: palette.slate300,
    tabBar: palette.navy900,
    tabIconDefault: palette.slate500,
    tabIconSelected: palette.mint500,
    switchTrackOff: palette.navy600,
    switchThumb: palette.frost50,

    bubble: palette.frost50,
    bubbleText: palette.navy950,
    bubbleTyping: palette.slate500,
    transcriptBackground: palette.scrim,
    roomShadow: palette.ink,
    roomLocalActor: palette.mint500,
    roomDoorEntry: palette.mint500,
    roomDoor: palette.frost50,
    roomDoorStroke: palette.ink,
    roomDoorKnob: palette.gold400,
    roomDoorWood: palette.wood500,
    roomDoorWoodDeep: palette.wood700,
    roomDoorWoodLight: palette.wood300,
    roomDoorGlint: palette.frost50,
    roomEditGrid: palette.sky400,
    roomItemSelected: palette.sky400,
    roomDropTarget: palette.mint500,
    roomDropBlocked: palette.red400,
    roomDebugGrid: palette.frost50,
    roomDebugItemCell: palette.debugOrange,
    roomDebugActorCell: palette.debugBlue,
  },
  shadows: {
    sticker: { boxShadow: `0px 3px 0px 0px ${palette.ink}` },
    floating: { boxShadow: `0px 4px 0px 0px ${palette.ink}, 0px 8px 18px 0px ${palette.shadowSoft}` },
  },
  avatarPalette: [
    palette.pastelCoral,
    palette.pastelTeal,
    palette.pastelSun,
    palette.pastelLilac,
    palette.pastelMint,
    palette.pastelPink,
    palette.pastelSky,
    palette.pastelPeach,
  ],
  ...tokens,
};

/**
 * Every theme the app can show. To add one (say a light theme), write another Theme
 * here with the same keys and pass its name to ThemeProvider.
 */
export const themes = {
  dark: darkTheme,
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;
