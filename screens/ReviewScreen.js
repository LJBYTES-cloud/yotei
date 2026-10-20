import { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, FocusCard, ScreenHeader, TaskCard } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button } from '../components/ui';

/** @typedef {{kind: 'block', block: import('../db/StudyBlockService').StudyBlock} | {kind: 'task', task: import('../db/TaskService').Task}} ReviewRow */

export default function ReviewScreen() {
  const { data, refresh } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  const r = useThemedStyles(createStyles);
  const list = useRef(null);
  useScrollToTop(list);
  // Review uses the same account-scoped workspace data and existing actions.
  const missed = useMemo(() => data.blocks.filter(block => block.status === 'missed' && !block.rescheduled_to), [data.blocks]);
  const postponed = useMemo(() => data.tasks.filter(task => task.postpone_count >= 2 && task.status === 'pending'), [data.tasks]);
  const rows = useMemo(() => /** @type {ReviewRow[]} */ ([
    ...missed.map(block => ({ kind: 'block', block })),
    ...postponed.map(task => ({ kind: 'task', task })),
  ]), [missed, postponed]);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList ref={list} data={rows} contentContainerStyle={s.content}
        keyExtractor={item => item.kind === 'block' ? `block-${item.block.id}` : `task-${item.task.id}`}
        refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6}
        ListHeaderComponent={<>
          <ScreenHeader title="Review" edition="A FRESH PERSPECTIVE" eyebrow="PAUSE, REFLECT, RESET" subtitle="Revisit missed sessions and tasks that have been hard to start. A smaller plan still counts." />
          <View style={s.card}>
            <Text style={s.sectionTitle}>There’s room for a fresh start.</Text>
            <View style={r.stats}>
              <View style={r.stat}><Text style={r.number}>{missed.length}</Text><Text style={s.hint}>missed sessions</Text></View>
              <View style={r.stat}><Text style={r.number}>{postponed.length}</Text><Text style={s.hint}>tasks to revisit</Text></View>
            </View>
            <Button label="Explore your Library ↗" onPress={() => router.navigate('/library')} />
          </View>
          <Feedback />
        </>}
        renderItem={({ item, index }) => <>
          {(index === 0 || rows[index - 1].kind !== item.kind) && <View style={s.card}><Text style={s.sectionTitle}>{item.kind === 'block' ? 'Missed sessions' : 'Try a smaller start'}</Text></View>}
          {item.kind === 'block' ? <FocusCard block={item.block} /> : <TaskCard task={item.task} />}
        </>}
        ListEmptyComponent={<EmptyState title="A clear page." text="No missed sessions or repeatedly postponed tasks to revisit. Keep moving at your own pace." />}
        ListFooterComponent={<Text style={s.footer}>A RESET IS PROGRESS, TOO.</Text>} />
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  stats: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  stat: { flex: 1, backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 12, gap: 8 },
  number: { color: p.text, fontSize: 28, lineHeight: 34, fontWeight: '700' },
});
