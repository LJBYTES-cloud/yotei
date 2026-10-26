import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { cardShadow, fonts, typeScale, typeLeading } from './typography';

/** @param {{title: string, message?: string, children?: import('react').ReactNode, onClose: () => void}} props */
export default function InfoModal({ title, message, children, onClose }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  return <Modal transparent visible animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider>
      <Pressable accessibilityRole="button" accessibilityLabel="Close Information" onPress={onClose} style={s.backdrop} />
      <SafeAreaView style={s.viewport} pointerEvents="box-none">
        <View style={s.dialog} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={s.header}><Ionicons name="information-circle-outline" size={24} color={p.accent} />
            <Text accessibilityRole="header" style={s.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Information" onPress={onClose} style={s.close}>
              <Ionicons name="close" size={22} color={p.muted} />
            </Pressable>
          </View>
          <ScrollView style={s.scroll} contentContainerStyle={s.content}>{message && <Text style={s.message}>{message}</Text>}{children}</ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]}>
            <Text style={s.buttonText}>OK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: p.overlay },
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { ...cardShadow, width: '100%', maxWidth: 440, maxHeight: '90%', padding: 24, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, borderRadius: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { flex: 1, fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 }, content: { paddingBottom: 24 },
  message: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.body, lineHeight: typeLeading.body },
  button: { backgroundColor: p.accent, borderRadius: 12, padding: 14, alignItems: 'center', minHeight: 52 },
  buttonText: { fontFamily: fonts.bold, color: p.onAccent, fontSize: typeScale.button, lineHeight: typeLeading.button },
});
