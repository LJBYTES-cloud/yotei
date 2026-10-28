import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../../ThemeContext';
import { StudyWorkspace } from '../../../components/StudyWorkspace';
import { fonts, typeScale, typeLeading } from '../../../components/typography';
import ToastTabBar from '../../../components/ToastTabBar';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <StudyWorkspace>
    <Tabs tabBar={props => <ToastTabBar {...props} />} screenOptions={{
      headerShown: false, tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
      tabBarActiveBackgroundColor: colors.accentSoft,
      tabBarItemStyle: { borderRadius: 12, marginHorizontal: 4, paddingVertical: 3 },
      sceneStyle: { backgroundColor: colors.background },
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line, borderTopWidth: 1, height: 70 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), elevation: 0 },
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: typeScale.small, lineHeight: typeLeading.small, letterSpacing: 0.4 },
      tabBarLabelPosition: 'below-icon',
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={23} color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "book" : "book-outline"} size={23} color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'journal' : 'journal-outline'} size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={23} color={color} /> }} />
    </Tabs>
  </StudyWorkspace>;
}
