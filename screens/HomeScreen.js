import { cardShadow, fonts, typeScale, typeLeading } from '../components/typography';
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
import { Button, InfoButton } from '../components/ui';
import FocusTimer from '../components/FocusTimer';
import WeeklyProgressCard from '../components/WeeklyProgressCard';

export default function HomeScreen() {
  const study = useStudy();
  const { data, clock, today, refresh, disabled } = study;
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const h = useThemedStyles(createStyles);
  const list = useRef(null);
  useScrollToTop(list);
  const blocks = useMemo(() => data.blocks.filter(block => !block.rescheduled_to).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')), [data.blocks]);
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
            <View style={h.summaryHeading}><Text style={h.kicker}>Daily Study Time</Text><InfoButton title="Daily Study Time" message="Planned minutes for scheduled, active and completed blocks count toward the 4-hour workload threshold. Missed sessions are excluded; overnight sessions are split by calendar day. The focus timer records studied time separately." /></View>
            <View style={h.numbers}><Text style={h.minutes}>{formatMinutes(data.minutes)}</Text><Text style={h.caption}>planned{ '\n' }& completed</Text></View>
            <View style={h.meter}><View style={[h.fill, { width: `${Math.min(data.minutes / 240 * 100, 100)}%`, backgroundColor: p.accent }]} /></View>
            {data.minutes > 240 && <Text style={h.summaryNote}>Over the 4-hour threshold</Text>}
            <View style={h.stats}><Text style={s.hint}><Text style={h.statNumber}>{planned}</Text> ahead</Text><Text style={s.hint}><Text style={h.statNumber}>{completed}</Text> done today</Text></View>
          </View>
          <Feedback />
          <WeeklyProgressCard userId={study.user.id} days={data.weekly} ready={data.ready} error={data.error} />
          {coaching.length > 0 && <View style={s.card}><View style={s.section}><Text style={s.sectionTitle}>Postponed Tasks</Text></View>{coaching.map(task => <CoachingCard key={task.id} task={task} />)}</View>}
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Today’s Focus</Text><Text style={s.sectionCount}>{String(blocks.length).padStart(2, '0')}</Text></View>
            <Button label="Plan a Session ↗" disabled={disabled} onPress={() => router.navigate('/library')} />
          </View>
        </>}
        renderItem={({ item }) => item.status === 'active' ? <FocusTimer block={item} /> : <FocusCard block={item} />}
        ListFooterComponent={<Text style={h.motto}>By students, for students.</Text>}
        ListEmptyComponent={<EmptyState title="No study blocks scheduled for today." text="Select a task in Library to schedule a study session." action="Open Library ↗" onPress={() => router.navigate('/library')} />} />
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  motto: { fontFamily: fonts.body, color: p.subtle, fontSize: typeScale.small, lineHeight: typeLeading.small, textAlign: 'center', paddingTop: 12, paddingBottom: 8 },
  summary: { ...cardShadow, backgroundColor: p.hero, borderWidth: 1, borderColor: p.heroLine, borderRadius: 16, padding: 24, marginBottom: 24 },
  kicker: { fontFamily: fonts.serifBold, color: p.accent, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal', flexShrink: 1 },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22, marginBottom: 24 },
  minutes: { fontFamily: fonts.bold, color: p.text, fontSize: typeScale.metric, lineHeight: typeLeading.metric, letterSpacing: -1.5, fontWeight: 'normal' }, caption: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small },
  meter: { height: 6, borderRadius: 3, backgroundColor: p.accentSoft, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 3 },
  summaryNote: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, marginTop: 24 },
  stats: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: p.heroLine, paddingTop: 26, marginTop: 30 }, statNumber: { fontFamily: fonts.semibold, color: p.text, fontWeight: 'normal' },
});
