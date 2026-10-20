import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** @param {{ label: string, onPress: () => void, busy?: boolean, disabled?: boolean, tone?: 'primary' | 'quiet' | 'outline', compact?: boolean }} props */
export function Button({ label, onPress, busy = false, disabled = false, tone = 'primary', compact = false }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  const blocked = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={onPress}
      style={({ pressed }) => [s.button, s[tone], compact && s.compact, pressed && s.pressed, blocked && s.disabled]}>
      {busy ? <ActivityIndicator color={tone === 'primary' ? p.onAccent : p.accent} /> : <Text style={[s.buttonText, tone !== 'primary' && s.lightButtonText]}>{label}</Text>}
    </Pressable>
  );
}

/** @param {{ label: string, selected?: boolean, onPress: () => void, disabled?: boolean, color?: string }} props */
export function Pill({ label, selected = false, onPress, disabled = false, color }) {
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.pill, selected && s.pillSelected, pressed && s.pressed]}>
      {color && <View style={[s.dot, { backgroundColor: subjectColor(color) }]} />}
      <Text style={[s.pillText, selected && s.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** @param {{ label: string } & import('react-native').TextInputProps} props */
export function Input({ label, ...props }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={p.subtle} selectionColor={p.accent}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...props} style={[s.input, focused && s.inputFocused, props.style]} />
    </View>
  );
}

/** @param {{ text: string, kind?: 'error' | 'notice' }} props */
export function Message({ text, kind = 'error' }) {
  const s = useThemedStyles(createStyles);
  if (!text) return null;
  return <Text accessibilityRole={kind === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.message, kind === 'notice' && s.notice]}>{text}</Text>;
}

/** @param {{ title: string, kicker: string, busy?: boolean, onClose: () => void, children: import('react').ReactNode }} props */
export function Sheet({ title, kicker, busy = false, onClose, children }) {
  const s = useThemedStyles(createStyles);
  const close = () => { if (!busy) onClose(); };
  return (
    <Modal transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView style={s.modalRoot} edges={['top']}>
          <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" disabled={busy} style={s.backdrop} onPress={close} />
          <KeyboardAvoidingView style={s.sheetContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
            <SafeAreaView style={s.sheet} edges={['bottom']} accessibilityViewIsModal onAccessibilityEscape={close}>
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <View style={s.sheetHeading}><Text style={s.kicker}>{kicker}</Text><Text style={s.sheetTitle}>{title}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={busy} onPress={close} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
              </View>
              <ScrollView style={s.sheetScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.sheetBody}>{children}</ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
  button: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  primary: { backgroundColor: p.accent, width: '100%', alignSelf: 'stretch' }, quiet: { backgroundColor: p.raised }, outline: { borderWidth: 1, borderColor: p.line },
  compact: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13 },
  buttonText: { color: p.onAccent, fontSize: 14, fontWeight: '700' }, lightButtonText: { color: p.text },
  pill: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, borderWidth: 1, borderColor: p.line, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  pillSelected: { borderColor: p.accent, backgroundColor: p.accentSoft }, pillText: { color: p.muted, fontSize: 13, fontWeight: '500' }, pillTextSelected: { color: p.accent },
  dot: { width: 7, height: 7, borderRadius: 4 }, field: { marginBottom: 16 }, label: { color: p.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 52, backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 10, color: p.text, fontSize: 16, padding: 12 },
  inputFocused: { borderColor: p.accent }, message: { color: p.error, fontSize: 13, lineHeight: 20, marginBottom: 16 }, notice: { color: p.green },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: p.overlay },
  sheetContainer: { flex: 1, justifyContent: 'flex-end', width: '100%', maxWidth: 600, alignSelf: 'center' },
  sheet: { maxHeight: '94%', backgroundColor: p.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: p.line, flexShrink: 1 },
  sheetScroll: { flexGrow: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: p.line, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }, sheetHeading: { flex: 1 },
  kicker: { color: p.accent, letterSpacing: 2, fontSize: 10, fontWeight: '700', marginBottom: 9 }, sheetTitle: { color: p.text, fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.8 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: p.raised, alignItems: 'center', justifyContent: 'center' }, closeText: { color: p.muted, fontSize: 28, lineHeight: 32 },
  sheetBody: { paddingHorizontal: 24, paddingBottom: 24 },
});
