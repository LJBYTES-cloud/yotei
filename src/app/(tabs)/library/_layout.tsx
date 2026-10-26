import { Stack } from 'expo-router';
import { useTheme } from '../../../../ThemeContext';

export const unstable_settings = { initialRouteName: 'index' };

export default function LibraryLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="[subjectId]" />
  </Stack>;
}
