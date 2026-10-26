import { fonts, typeScale, typeLeading } from './components/typography';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather/400Regular';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

function Application() {
  const { colors, isDark } = useTheme();
  // Native study storage is intentionally unavailable in the browser.
  if (Platform.OS === 'web') {
    return (
      <View style={[webStyles.screen, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[webStyles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[webStyles.title, { color: colors.text }]}>Open Yotei on Mobile</Text>
          <Text style={[webStyles.message, { color: colors.muted }]}>Study data uses native SQLite. Open the Android or iOS app to access your study space.</Text>
        </View>
      </View>
    );
  }
  return <SessionProvider><Routes /></SessionProvider>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Merriweather_400Regular, Merriweather_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  // Bundled assets load before screens mount; a font error permits system fallback.
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider><Application /></ThemeProvider>
    </SafeAreaProvider>
  );
}

const webStyles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: 16, padding: 24, gap: 12 },
  title: { fontFamily: fonts.serifBold, fontSize: typeScale.h2, lineHeight: typeLeading.h2, fontWeight: 'normal' },
  message: { fontFamily: fonts.body, fontSize: typeScale.body, lineHeight: typeLeading.body },
});
