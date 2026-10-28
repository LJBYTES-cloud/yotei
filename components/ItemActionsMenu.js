import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { fonts, typeScale, typeLeading } from './typography';
import { Button } from './ui';

/** @typedef {{label: string, onPress: () => void, tone?: 'primary' | 'quiet' | 'outline' | 'danger'}} MenuAction */
/** Custom actions override the optional, backward-compatible Edit/Delete pair.
 * @param {{label: string, disabled?: boolean, busy?: boolean, actions?: MenuAction[], editLabel?: string, deleteLabel?: string, onEdit?: () => void, onDelete?: () => void}} props */
export default function ItemActionsMenu({ label, disabled = false, busy = false, actions, editLabel = 'Edit', deleteLabel = 'Delete', onEdit, onDelete }) {
  const { colors: p } = useTheme(), s = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false);
  const pending = useRef(/** @type {(() => void) | null} */ (null));
  const options = actions ?? /** @type {MenuAction[]} */ ([
    ...(onEdit ? [{ label: editLabel, tone: 'outline', onPress: onEdit }] : []),
    ...(onDelete ? [{ label: deleteLabel, tone: 'danger', onPress: onDelete }] : []),
  ]);
  const finishClose = useCallback(() => {
    const action = pending.current; pending.current = null;
    setMounted(false); action?.();
  }, []);
  useEffect(() => {
    // iOS must finish dismissing before an editor/confirmation is presented.
    // Android does not guarantee Modal.onDismiss, so finish after its commit.
    if (mounted && !open && Platform.OS !== 'ios') {
      const frame = requestAnimationFrame(finishClose);
      return () => cancelAnimationFrame(frame);
    }
  }, [mounted, open, finishClose]);
  useEffect(() => () => { pending.current = null; }, []);
  function choose(/** @type {() => void} */ action) { if (!open || pending.current || disabled || busy) return; pending.current = action; setOpen(false); }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${label}`} accessibilityState={{ expanded: open, disabled: disabled || busy, busy }}
      disabled={disabled || busy || (mounted && !open)} onPress={() => { setMounted(true); setOpen(true); }} style={s.trigger}>
      {busy ? <ActivityIndicator color={p.accent} size="small" /> : <Ionicons name="ellipsis-vertical" color={p.muted} size={22} />}
    </Pressable>
    {mounted && <Modal transparent visible={open} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)} onDismiss={finishClose}>
      <SafeAreaProvider>
        <Pressable accessibilityLabel="Close Actions" accessibilityRole="button" onPress={() => setOpen(false)} style={s.backdrop} />
        <SafeAreaView style={s.viewport} pointerEvents="box-none">
          <View style={s.sheet} accessibilityViewIsModal onAccessibilityEscape={() => setOpen(false)}>
            <Text style={s.title}>{label}</Text>
            {options.map((action, index) => <Button key={`${index}-${action.label}`} label={action.label} tone={action.tone ?? 'outline'}
              disabled={disabled || busy} onPress={() => choose(action.onPress)} />)}
            <Button label="Cancel" tone="quiet" onPress={() => setOpen(false)} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>}
  </>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  trigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: p.overlay },
  viewport: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, borderRadius: 20, padding: 24, gap: 16 },
  title: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, marginBottom: 8 },
});
