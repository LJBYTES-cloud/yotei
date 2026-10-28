import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'yotei.theme';
const THEME_VERSION = 2;
// Keep rapid toggles (and provider remounts) in order on persistent storage.
let themeWrites = Promise.resolve();

export const darkPalette = {
  background: '#121412', surface: '#1C201D', raised: '#272E29', input: '#161B17',
  line: '#343C35', text: '#F0F0F0', muted: '#B6C0B8', subtle: '#96A399',
  accent: '#7CB58F', accentSoft: '#26392C', onAccent: '#102216',
  warm: '#D6BA89', warmSoft: '#332D22', green: '#7CB58F', greenSoft: '#26392C',
  error: '#E5A4A4', errorSoft: '#352525', errorLine: '#704747',
  hero: '#1C201D', heroLine: '#343C35', overlay: 'rgba(0,0,0,0.68)',
  bookPaper: '#272E29', bookInk: '#F0F0F0', bookPages: '#343C35', bookRule: 'rgba(240,240,240,0.18)',
};

export const lightPalette = {
  background: '#F8F6F2', surface: '#FFFFFF', raised: '#F0EDE6', input: '#FAF9F6',
  line: '#E0DCD3', text: '#1F1F1F', muted: '#5E685F', subtle: '#6D756E',
  accent: '#2D5A41', accentSoft: '#E8F0E9', onAccent: '#FFFFFF',
  warm: '#7C6030', warmSoft: '#F6EFDF', green: '#2D5A41', greenSoft: '#E8F0E9',
  error: '#993F3F', errorSoft: '#F9ECE8', errorLine: '#DFC1B9',
  hero: '#FFFFFF', heroLine: '#E0DCD3', overlay: 'rgba(18,20,18,0.4)',
  bookPaper: '#FAF7F0', bookInk: '#111111', bookPages: '#E8E3DA', bookRule: 'rgba(0,0,0,0.25)',
};

/** @typedef {typeof darkPalette} ThemeColors */
/** @typedef {{ colors: ThemeColors, isDark: boolean, toggleTheme: () => void, subjectColor: (storedColor: string) => string }} ThemeValue */
const ThemeContext = createContext(/** @type {ThemeValue | null} */ (null));
// A list can mount many consumers of the same style factory. Build each
// palette/factory pair once and reuse it across rows and return theme toggles.
/** @type {WeakMap<Function, WeakMap<ThemeColors, unknown>>} */
const styleCache = new WeakMap();

/** @param {{children: import('react').ReactNode, fallback?: import('react').ReactNode}} props */
export function ThemeProvider({ children, fallback = null }) {
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);
  const currentTheme = useRef(false);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        await themeWrites;
        const raw = await AsyncStorage.getItem(THEME_KEY);
        let saved = null;
        try { saved = raw ? JSON.parse(raw) : null; } catch { /* Old plain-string choices belong to the reversed-switch UI. */ }
        if (active) {
          // Reset legacy/incomplete preferences to Light once. Only an explicit
          // choice made with the corrected switch can opt back into Dark.
          currentTheme.current = saved?.version === THEME_VERSION && saved.mode === 'dark';
          setIsDark(currentTheme.current);
        }
      } catch (error) {
        console.warn('[ThemeContext] Could not restore theme preference.', error);
      } finally { if (active) setReady(true); }
    }
    void restore();
    return () => { active = false; };
  }, []);
  const toggleTheme = useCallback(() => {
    const next = !currentTheme.current;
    currentTheme.current = next;
    setIsDark(next);
    themeWrites = themeWrites.then(() => AsyncStorage.setItem(THEME_KEY, JSON.stringify({ version: THEME_VERSION, mode: next ? 'dark' : 'light' })))
      .catch(error => { console.warn('[ThemeContext] Could not save theme preference.', error); });
  }, []);
  useEffect(() => {
    if (ready && Platform.OS !== 'web') {
      Appearance.setColorScheme(isDark ? 'dark' : 'light');
      void SystemUI.setBackgroundColorAsync(isDark ? darkPalette.background : lightPalette.background).catch(() => {});
    }
  }, [isDark, ready]);
  const value = useMemo(() => ({
    colors: isDark ? darkPalette : lightPalette,
    isDark,
    toggleTheme,
    // Keep book colors stored, with restrained markers on the cream pages.
    subjectColor: (/** @type {string} */ storedColor) => isDark ? storedColor : lightPalette.text,
  }), [isDark, toggleTheme]);
  // Mount screens only once the preference is read, avoiding a wrong-theme flash.
  if (!ready) return fallback;
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
  return useMemo(() => {
    let palettes = styleCache.get(factory);
    if (!palettes) { palettes = new WeakMap(); styleCache.set(factory, palettes); }
    if (!palettes.has(colors)) palettes.set(colors, factory(colors));
    return /** @type {T} */ (palettes.get(colors));
  }, [factory, colors]);
}
