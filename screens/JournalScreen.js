import { memo, useCallback, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { fonts, typeScale, typeLeading } from '../components/typography';
import { EmptyState, Feedback, ScreenHeader } from '../components/StudyCards';
import { Button } from '../components/ui';
import { useTimeFormat } from '../TimeFormatContext';

/** @param {{item: import('../db/JournalService').JournalFeedItem, disabled: boolean, onOpen: (item: import('../db/JournalService').JournalFeedItem) => void}} props */
function JournalCard({ item, disabled, onOpen }) {
  const s = useThemedStyles(createStudyStyles), j = useThemedStyles(createStyles);
  const { colors: p } = useTheme();
  const { formatDateTime } = useTimeFormat();
  const open = useCallback(() => onOpen(item), [item, onOpen]);
  return <View style={j.row}>
    <View style={j.rail}><View style={j.dot} /><View style={j.line} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Read ${item.title}`} disabled={disabled} onPress={open} style={[s.card, j.entry]}>
      <View style={j.meta}><Text style={j.kind}>{item.kind === 'entry' ? 'Journal Entry' : 'Session Reflection'}</Text><Ionicons name={item.kind === 'entry' ? 'create-outline' : 'timer-outline'} color={p.muted} size={18} /></View>
      <Text style={[s.hint, { marginBottom: 16 }]}>{formatDateTime(item.created_at)}</Text>
      {item.subject_name && <Text style={s.subject}>{item.subject_name}</Text>}
      <Text style={[s.title, { marginVertical: 12 }]}>{item.title}</Text><Text style={s.reflectionNote} numberOfLines={4}>{item.content}</Text>
    </Pressable>
  </View>;
}

const MemoJournalCard = memo(JournalCard);

/** @param {import('../db/JournalService').JournalFeedItem} item */
const journalKey = item => item.id;

export default function JournalScreen() {
  const { data, disabled, refresh, refreshInBackground, openJournalEntry, openJournalDetail } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  const list = useRef(null);
  useScrollToTop(list);
  const renderEntry = useCallback((/** @type {import('react-native').ListRenderItemInfo<import('../db/JournalService').JournalFeedItem>} */ { item }) => <MemoJournalCard item={item} disabled={disabled} onOpen={openJournalDetail} />, [disabled, openJournalDetail]);
  useFocusEffect(useCallback(() => { refreshInBackground(); }, [refreshInBackground]));
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <FlatList ref={list} data={data.journal} keyExtractor={journalKey} contentContainerStyle={s.content}
      initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
      refreshing={data.ready && data.refreshing} onRefresh={refresh}
      ListHeaderComponent={<>
        <ScreenHeader title="Journal" edition="Study Notes" />
        <View style={{ marginBottom: 28 }}><Button label="New Entry" disabled={disabled} onPress={openJournalEntry} /></View>
        <Feedback />
      </>}
      renderItem={renderEntry}
      ListEmptyComponent={<EmptyState title="No Journal Entries Yet" text="Create a journal entry or reflect after finishing a focus session." />} />
  </SafeAreaView>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 }, rail: { width: 10, alignItems: 'center', paddingTop: 26 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: p.accent }, line: { width: 1, flex: 1, marginTop: 8, backgroundColor: p.line },
  entry: { flex: 1, minWidth: 0 }, meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  kind: { fontFamily: fonts.semibold, fontSize: typeScale.small, lineHeight: typeLeading.small, color: p.accent },
});
