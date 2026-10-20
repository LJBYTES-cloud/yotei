import { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getLocalDayRange } from '../db/dateUtils';
import { CoachingCard, EmptyState, Feedback, FocusCard, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { formatMinutes } from '../components/theme';
import { Button } from '../components/ui';

export default function HomeScreen() {
  const study = useStudy();
  const { data, clock, today, refresh, disabled } = study;
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const h = useThemedStyles(createStyles);
  const list = useRef(null);
  useScrollToTop(list);
  const blocks = useMemo(() => data.blocks.filter(block => !block.rescheduled_to), [data.blocks]);
  const coaching = useMemo(() => data.tasks.filter(task => task.postpone_count >= 2).slice(0, 2), [data.tasks]);
  const dayRange = getLocalDayRange(today);
  const completed = blocks.filter(block => block.status === 'done' && Date.parse(block.start_time) < Date.parse(dayRange.end) && Date.parse(block.end_time) > Date.parse(dayRange.start)).length;
  const planned = blocks.filter(block => block.status === 'scheduled').length;
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList ref={list} data={blocks} keyExtractor={block => String(block.id)} contentContainerStyle={s.content}
        refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6}
        ListHeaderComponent={<>
          <ScreenHeader title="Home" eyebrow={new Date(clock).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} subtitle="View scheduled sessions and daily study time." />
          <View style={h.summary}>
            <Text style={h.kicker}>DAILY STUDY TIME</Text>
            <View style={h.numbers}><Text style={h.minutes}>{formatMinutes(data.minutes)}</Text><Text style={h.caption}>planned{ '\n' }& completed</Text></View>
            <View style={h.meter}><View style={[h.fill, { width: `${Math.min(data.minutes / 240 * 100, 100)}%`, backgroundColor: data.minutes > 240 ? p.warm : p.accent }]} /></View>
            <Text style={h.summaryNote}>{data.minutes > 240 ? 'Daily study time exceeds 4 hours. Schedule breaks.' : 'Daily workload warning threshold: 4 hours.'}</Text>
            <View style={h.stats}><Text style={s.hint}><Text style={h.statNumber}>{planned}</Text> ahead</Text><Text style={s.hint}><Text style={h.statNumber}>{completed}</Text> done today</Text></View>
          </View>
          <Feedback />
          {coaching.length > 0 && <View style={s.card}><View style={s.section}><Text style={s.sectionTitle}>Postponed tasks</Text></View>{coaching.map(task => <CoachingCard key={task.id} task={task} />)}</View>}
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Today’s Focus</Text><Text style={s.sectionCount}>{String(blocks.length).padStart(2, '0')}</Text></View>
            <Button label="Plan a session ↗" disabled={disabled} onPress={() => router.navigate('/library')} />
          </View>
        </>}
        renderItem={({ item }) => <FocusCard block={item} />}
        ListEmptyComponent={<EmptyState title="No study blocks scheduled for today." text="Select a task in Library to schedule a study session." action="Open Library ↗" onPress={() => router.navigate('/library')} />} />
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  summary: { backgroundColor: p.hero, borderWidth: 1, borderColor: p.heroLine, borderRadius: 16, padding: 16, marginBottom: 12 },
  kicker: { color: p.accent, fontSize: 9, fontWeight: '600', letterSpacing: 1.8 },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22, marginBottom: 24 },
  minutes: { color: p.text, fontSize: 42, letterSpacing: -1.5, fontWeight: '700' }, caption: { color: p.muted, fontSize: 12, lineHeight: 20 },
  meter: { height: 3, borderRadius: 2, backgroundColor: p.line, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 2 },
  summaryNote: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 16 },
  stats: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: p.heroLine, paddingTop: 18, marginTop: 22 }, statNumber: { color: p.text, fontWeight: '600' },
});
