import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './auth/SessionContext';
import { ThemeProvider, useTheme } from './ThemeContext';

function Routes() {
  const { user, restoring, restoreError } = useSession();
  const { colors, isDark } = useTheme();
  const authenticated = Boolean(user) && !restoring && !restoreError;
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent, background: colors.background, card: colors.surface,
      text: colors.text, border: colors.line, notification: colors.accent,
    },
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={authenticated}><Stack.Screen name="(tabs)" /></Stack.Protected>
        <Stack.Protected guard={!authenticated}><Stack.Screen name="sign-in" /></Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider><SessionProvider><Routes /></SessionProvider></ThemeProvider>
    </SafeAreaProvider>
  );
}
