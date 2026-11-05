import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { darkTheme, themes, type Theme, type ThemeName } from './themes';

/** What StyleSheet.create accepts. Intersecting with it keeps style literals like 'row' narrow. */
type Styles = Parameters<typeof StyleSheet.create>[0];

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeName: 'dark',
  setThemeName: () => {},
});

/** Provides the active theme. Mount once at the root. */
export function ThemeProvider({ initial = 'dark', children }: Readonly<{ initial?: ThemeName; children: ReactNode }>) {
  const [themeName, setThemeName] = useState<ThemeName>(initial);
  const value = useMemo(() => ({ theme: themes[themeName], themeName, setThemeName }), [themeName]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme: colors, shadows and tokens. */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** The active theme's name and a setter, for a theme picker. */
export function useThemeName(): Pick<ThemeContextValue, 'themeName' | 'setThemeName'> {
  const { themeName, setThemeName } = useContext(ThemeContext);
  return { themeName, setThemeName };
}

/**
 * Themed stylesheets. Define styles once, outside the component, from the theme:
 *
 *   const useStyles = makeStyles(t => ({ card: { backgroundColor: t.colors.surface } }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * Each theme's sheet is built once and cached, so switching themes restyles everything.
 */
export function makeStyles<S extends Styles>(factory: (t: Theme) => S & Styles) {
  const cache = new WeakMap<Theme, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
