import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { fonts, typeScale, typeLeading } from './typography';
import InfoModal from './InfoModal';

const SheetInputContext = createContext(/** @type {((input: import('react-native').TextInput | null) => void) | null} */ (null));

/** @param {{title: string, message: string}} props */
export function InfoButton({ title, message }) {
  const { colors } = useTheme();
  const s = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  return <><Pressable accessibilityRole="button" accessibilityLabel={`Information about ${title}`} hitSlop={6}
    onPress={() => setOpen(true)}
    style={({ pressed }) => [s.infoButton, pressed && s.pressed]}>
    <Ionicons name="information-circle-outline" size={19} color={colors.muted} />
  </Pressable>{open && <InfoModal title={title} message={message} onClose={() => setOpen(false)} />}</>;
}

/** @param {{label: string, help?: string, textStyle?: import('react-native').StyleProp<import('react-native').TextStyle>}} props */
export function FieldLabel({ label, help, textStyle }) {
  const s = useThemedStyles(createStyles);
  return <View style={s.labelRow}>
    <Text style={[s.labelText, textStyle, { marginBottom: 0 }]}>{label}</Text>
    {help && <InfoButton title={label} message={help} />}
  </View>;
}

/** @param {{ label: string, accessibilityLabel?: string, onPress: () => void, busy?: boolean, disabled?: boolean, tone?: 'primary' | 'quiet' | 'outline' | 'danger', compact?: boolean, style?: import('react-native').StyleProp<import('react-native').ViewStyle>, textStyle?: import('react-native').StyleProp<import('react-native').TextStyle> }} props */
export function Button({ label, accessibilityLabel = label, onPress, busy = false, disabled = false, tone = 'primary', compact = false, style, textStyle }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  const blocked = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={onPress}
      style={({ pressed }) => [s.button, s[tone], compact && s.compact, style, pressed && s.pressed, blocked && s.disabled]}>
      {busy ? <ActivityIndicator color={tone === 'danger' ? p.error : tone === 'primary' ? p.onAccent : p.accent} /> : <Text style={[s.buttonText, tone !== 'primary' && s.lightButtonText, tone === 'danger' && s.dangerText, textStyle]}>{label}</Text>}
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

/** @param {{ label: string, help?: string } & import('react-native').TextInputProps} props */
export function Input({ label, help, onFocus, onBlur, ...props }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(/** @type {import('react-native').TextInput | null} */ (null));
  const focusSheetInput = useContext(SheetInputContext);
  return (
    <View style={s.field}>
      <FieldLabel label={label} help={help} />
      <TextInput accessibilityLabel={label} placeholderTextColor={p.subtle} selectionColor={p.accent} {...props} ref={inputRef}
        onFocus={event => { setFocused(true); focusSheetInput?.(inputRef.current); onFocus?.(event); }}
        onBlur={event => { setFocused(false); focusSheetInput?.(null); onBlur?.(event); }}
        style={[s.input, focused && s.inputFocused, props.style]} />
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
  const scrollRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));
  const focusedInput = useRef(/** @type {import('react-native').TextInput | null} */ (null));
  const pendingFrame = useRef(/** @type {number | null} */ (null));
  const scrollOffset = useRef(0);
  const revealFocusedInput = useCallback(() => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    // Wait for keyboard avoidance to lay out the smaller scroll viewport.
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const input = focusedInput.current;
      const scroll = scrollRef.current;
      const viewport = scroll?.getNativeScrollRef();
      if (!input || !scroll || !viewport) return;
      input.measureInWindow((_x, inputTop, _width, inputHeight) => {
        viewport.measureInWindow((_scrollX, scrollTop, _scrollWidth, scrollHeight) => {
          if (focusedInput.current !== input || scrollRef.current !== scroll || scrollHeight <= 0) return;
          // Both measurements use window coordinates, including the sheet header.
          const below = inputTop + inputHeight + 20 - (scrollTop + scrollHeight);
          const above = scrollTop + 20 - inputTop;
          if (below <= 0 && above <= 0) return;
          const y = Math.max(0, scrollOffset.current + (below > 0 ? below : -above));
          scrollOffset.current = y;
          scroll.scrollTo({ y, animated: false });
        });
      });
    });
  }, []);
  const focusSheetInput = useCallback(/** @param {import('react-native').TextInput | null} input */ input => {
    focusedInput.current = input;
    if (input) revealFocusedInput();
  }, [revealFocusedInput]);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    return () => {
      subscription.remove();
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    };
  }, [revealFocusedInput]);
  const close = () => { if (!busy) onClose(); };
  return (
    <Modal transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <SafeAreaProvider>
        <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" disabled={busy} style={s.backdrop} onPress={close} />
        <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} pointerEvents="box-none">
          <SafeAreaView style={s.sheetContainer} edges={['top']} pointerEvents="box-none">
            <SafeAreaView style={s.sheet} edges={['bottom']} accessibilityViewIsModal onAccessibilityEscape={close}>
              <View style={s.handle} />
              <ScrollView ref={scrollRef} style={s.sheetScroll} onLayout={revealFocusedInput} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={false} contentContainerStyle={s.sheetContent}>
                <View style={s.sheetHeader}>
                  <View style={s.sheetHeading}><Text style={s.kicker}>{kicker}</Text><Text style={s.sheetTitle}>{title}</Text></View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={busy} onPress={close} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
                </View>
                <View style={s.sheetBody}><SheetInputContext.Provider value={focusSheetInput}>{children}</SheetInputContext.Provider></View>
              </ScrollView>
            </SafeAreaView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
  button: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  primary: { backgroundColor: p.accent, width: '100%', alignSelf: 'stretch' }, quiet: { backgroundColor: p.raised }, outline: { borderWidth: 1, borderColor: p.line },
  danger: { backgroundColor: p.errorSoft, borderWidth: 1, borderColor: p.errorLine }, dangerText: { color: p.error },
  compact: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13 },
  buttonText: { fontFamily: fonts.bold, color: p.onAccent, fontSize: typeScale.button, lineHeight: typeLeading.button, fontWeight: 'normal' }, lightButtonText: { color: p.text },
  pill: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, borderWidth: 1, borderColor: p.line, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  pillSelected: { borderColor: p.accent, backgroundColor: p.accentSoft }, pillText: { fontFamily: fonts.medium, color: p.muted, fontSize: typeScale.body, lineHeight: typeLeading.body, fontWeight: 'normal' }, pillTextSelected: { color: p.accent },
  dot: { width: 7, height: 7, borderRadius: 4 }, field: { marginBottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4, marginBottom: 8 },
  labelText: { fontFamily: fonts.semibold, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', flexShrink: 1 }, infoButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  input: { fontFamily: fonts.body, minHeight: 52, backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 10, color: p.text, fontSize: typeScale.body, lineHeight: typeLeading.body, padding: 12 },
  inputFocused: { borderColor: p.accent }, message: { fontFamily: fonts.body, color: p.error, fontSize: typeScale.body, lineHeight: typeLeading.body, marginBottom: 16 }, notice: { color: p.green },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: p.overlay },
  sheetContainer: { flex: 1, justifyContent: 'flex-end', width: '100%', maxWidth: 600, alignSelf: 'center' },
  sheet: { maxHeight: '94%', minHeight: 0, backgroundColor: p.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: p.line, flexShrink: 1 },
  sheetScroll: { minHeight: 0, flexGrow: 0, flexShrink: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: p.line, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }, sheetHeading: { flex: 1 },
  kicker: { fontFamily: fonts.bold, color: p.accent, letterSpacing: 2, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', marginBottom: 9 }, sheetTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h1, lineHeight: typeLeading.h1, fontWeight: 'normal', letterSpacing: -0.8 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: p.raised, alignItems: 'center', justifyContent: 'center' }, closeText: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.h1, lineHeight: typeLeading.h1 },
  sheetContent: { paddingBottom: 32 }, sheetBody: { paddingHorizontal: 24 },
});
