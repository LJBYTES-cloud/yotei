import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

export const darkPalette = {
  background: '#0C1117', surface: '#151D27', raised: '#202A36', input: '#0E151E',
  line: '#293442', text: '#F4F0E9', muted: '#AAB3C0', subtle: '#7F8B9C',
  accent: '#C2ACF3', accentSoft: '#292338', onAccent: '#0C1117',
  warm: '#EAC68D', warmSoft: '#302A24', green: '#B0CDBD', greenSoft: '#233029',
  error: '#FFC2C9', errorSoft: '#352126', errorLine: '#6A3943',
  hero: '#151D27', heroLine: '#293442', overlay: 'rgba(0,0,0,0.68)',
};

export const lightPalette = {
  background: '#F5F5F5', surface: '#FFFFFF', raised: '#EEEEEE', input: '#F5F5F5',
  line: '#E0E0E0', text: '#000000', muted: '#000000', subtle: '#000000',
  accent: '#000000', accentSoft: '#EDEDED', onAccent: '#FFFFFF',
  warm: '#000000', warmSoft: '#EFEFEF', green: '#000000', greenSoft: '#ECECEC',
  error: '#000000', errorSoft: '#EEEEEE', errorLine: '#777777',
  hero: '#FFFFFF', heroLine: '#E0E0E0', overlay: 'rgba(0,0,0,0.4)',
};

/** @typedef {typeof darkPalette} ThemeColors */
/** @typedef {{ colors: ThemeColors, isDark: boolean, toggleTheme: () => void, subjectColor: (storedColor: string) => string }} ThemeValue */
const ThemeContext = createContext(/** @type {ThemeValue | null} */ (null));

/** @param {{children: import('react').ReactNode}} props */
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(isDark ? 'dark' : 'light');
      void SystemUI.setBackgroundColorAsync(isDark ? darkPalette.background : lightPalette.background).catch(() => {});
    }
  }, [isDark]);
  const value = useMemo(() => ({
    colors: isDark ? darkPalette : lightPalette,
    isDark,
    toggleTheme: () => setIsDark(current => !current),
    // Keep stored subject colors intact while presenting light mode in B&W.
    subjectColor: (/** @type {string} */ storedColor) => isDark || /^#([0-9a-f]{2})\1\1$/i.test(storedColor) ? storedColor : lightPalette.text,
  }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider.');
  return theme;
}

/** @template T @param {(colors: ThemeColors) => T} factory @returns {T} */
export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
