import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { cardShadow, fonts, typeScale, typeLeading } from './typography';
import { Button, Message } from './ui';

/** @param {{taskTitle: string, busy: boolean, error: string, onCancel: () => void, onConfirm: () => void}} props */
export default function BlockDeletionModal({ taskTitle, busy, error, onCancel, onConfirm }) {
  const { colors: p } = useTheme(), s = useThemedStyles(createStyles);
  const close = () => { if (!busy) onCancel(); };
  return <Modal transparent visible animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <SafeAreaProvider>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel Block Deletion" disabled={busy} onPress={close} style={s.backdrop} />
      <SafeAreaView style={s.viewport} pointerEvents="box-none">
        <View style={s.dialog} accessibilityViewIsModal onAccessibilityEscape={close}>
          <View style={s.header}><Ionicons name="trash-outline" size={24} color={p.error} /><Text accessibilityRole="header" style={s.title}>Delete Block?</Text></View>
          <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            <Text style={s.task}>{taskTitle}</Text>
            <Text style={s.message}>Delete this scheduled study block? The task and its other sessions will be kept in your Library.</Text>
            <Message text={error} />
          </ScrollView>
          <View style={s.actions}>
            <Button label="Cancel" tone="outline" disabled={busy} onPress={close} style={s.action} />
            <Button label="Delete Block" tone="danger" busy={busy} onPress={() => { if (!busy) onConfirm(); }} style={s.action} />
          </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  title: { flex: 1, fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h2, lineHeight: typeLeading.h2 },
  scroll: { flexGrow: 0, flexShrink: 1 }, content: { gap: 16, paddingBottom: 24 },
  task: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3 },
  message: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.body, lineHeight: typeLeading.body },
  actions: { flexDirection: 'row', gap: 12 }, action: { flex: 1, minWidth: 0 },
});
