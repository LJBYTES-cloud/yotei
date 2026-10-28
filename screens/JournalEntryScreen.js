import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { fonts, typeLeading, typeScale } from '../components/typography';
import JournalEntryContent from '../components/JournalEntryContent';
import { Feedback } from '../components/StudyCards';

export default function JournalEntryScreen() {
  const { entryId } = useLocalSearchParams();
  const { user, data, setNotice, setJournalEditing } = useStudy();
  const { colors } = useTheme();
  const s = useThemedStyles(createStudyStyles), j = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);
  const item = typeof entryId === 'string' ? data.journal.find(row => row.id === entryId) : undefined;
  const back = useCallback(() => { if (!busy) { if (router.canGoBack()) router.back(); else router.replace('/journal'); } }, [busy]);
  const setMutation = useCallback((/** @type {boolean} */ value) => { setBusy(value); setJournalEditing(value); }, [setJournalEditing]);
  const saved = useCallback(() => { setNotice('Journal entry updated.'); void data.refresh(); }, [data.refresh, setNotice]);
  const deleted = useCallback(() => { setNotice('Journal entry deleted.'); void data.refresh(); router.replace('/journal'); }, [data.refresh, setNotice]);
  useEffect(() => {
    if (!busy) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => listener.remove();
  }, [busy]);
  if (data.ready && !data.error && !item) return <Redirect href="/journal" />;
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Journal" disabled={busy} onPress={back} style={j.back}>
          <Ionicons name="arrow-back" color={colors.accent} size={20} /><Text style={j.backText}>Journal</Text>
        </Pressable>
        <Feedback />
        {item && <View style={s.card}>
          <Text style={j.kind}>{item.kind === 'entry' ? 'Journal Entry' : 'Session Reflection'}</Text>
          <JournalEntryContent key={item.id} userId={user.id} item={item} onSaved={saved} onDeleted={deleted} onBusyChange={setMutation} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 24 },
  backText: { fontFamily: fonts.semibold, fontSize: typeScale.button, lineHeight: typeLeading.button, color: p.accent },
  kind: { fontFamily: fonts.semibold, fontSize: typeScale.small, lineHeight: typeLeading.small, color: p.accent, marginBottom: 16 },
});
