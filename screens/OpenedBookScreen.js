import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useStudy } from '../components/StudyWorkspace';
import { EmptyState, Feedback, TaskCard } from '../components/StudyCards';
import { Button } from '../components/ui';
import { createStudyStyles } from '../components/studyStyles';
import { cardShadow, fonts, typeScale, typeLeading } from '../components/typography';
import StudyMaterials from '../components/StudyMaterials';

export default function OpenedBookScreen() {
  const { subjectId } = useLocalSearchParams();
  const id = typeof subjectId === 'string' && /^[1-9]\d*$/.test(subjectId) ? Number(subjectId) : NaN;
  const { data, clock, disabled, openEntry, openEditSubject, confirmDeleteSubject, deletingSubject, refresh } = useStudy();
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const n = useThemedStyles(createStyles);
  const subject = data.subjects.find(item => item.id === id);
  const tasks = useMemo(() => data.tasks.filter(task => task.subject_id === id), [data.tasks, id]);
  // Deletion/import or an unowned/invalid route must never show another book's tasks.
  if (data.ready && !data.error && !subject) return <Redirect href="/library" />;
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <FlatList data={subject ? tasks : []} keyExtractor={task => String(task.id)} contentContainerStyle={s.content}
      refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6}
      ListHeaderComponent={<>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Library" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} style={n.back}>
          <Ionicons name="arrow-back" color={p.accent} size={20} /><Text style={n.backText}>Library</Text>
        </Pressable>
        <Feedback />
        {subject && <View style={n.pageHeader}>
          <View pointerEvents="none" style={n.binding}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={n.bindingHole} />)}</View>
          <Text style={n.code}>{subject.subject_code}</Text>
          <Text accessibilityRole="header" style={n.title}>{subject.name}</Text>
          <Text style={n.field}>{subject.field_of_study}</Text>
          <View style={n.actions}>
            <Button label="New Task" disabled={disabled} onPress={() => openEntry('task', subject.id)} />
            <View style={n.bookTools}>
              <Button label="Edit Book" compact tone="outline" disabled={disabled} onPress={() => openEditSubject(subject)} />
              <Button label="Delete Book" compact tone="danger" disabled={disabled} busy={deletingSubject === subject.id} onPress={() => confirmDeleteSubject(subject)} />
            </View>
          </View>
          <View style={n.section}><Text style={n.sectionTitle}>Tasks</Text><Text style={n.taskCount}>{tasks.length}</Text></View>
        </View>}
      </>}
      renderItem={({ item }) => <View style={n.paperRow}><View pointerEvents="none" style={n.marginRule} />
        <TaskCard task={item} notebook hasMissedSession={Boolean(item.has_missed_session) && !(Date.parse(item.latest_scheduled_start ?? '') > clock)} />
      </View>}
      ListEmptyComponent={<View style={subject ? n.paperRow : undefined}><EmptyState title="No Tasks in This Book" text="Add a task to this subject to schedule a study session." /></View>}
      ListFooterComponent={subject ? <><StudyMaterials subjectId={subject.id} /><View style={n.pageFooter} /></> : null} />
  </SafeAreaView>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 20, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.semibold, color: p.accent, fontSize: typeScale.button, lineHeight: typeLeading.button, fontWeight: 'normal' },
  pageHeader: { ...cardShadow, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 24, paddingBottom: 0 },
  binding: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 },
  bindingHole: { width: 7, height: 7, borderRadius: 4, backgroundColor: p.background, borderWidth: 1, borderColor: p.line },
  code: { fontFamily: fonts.bold, color: p.accent, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', letterSpacing: 1.7, marginBottom: 12 },
  title: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h1, lineHeight: typeLeading.h1, fontWeight: 'normal', marginBottom: 12 },
  field: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.body, lineHeight: typeLeading.body },
  actions: { gap: 12, marginTop: 28, marginBottom: 30 }, bookTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, borderTopWidth: 1, borderTopColor: p.line },
  sectionTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal' }, taskCount: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.body, lineHeight: typeLeading.body },
  paperRow: { backgroundColor: p.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: p.line },
  marginRule: { position: 'absolute', left: 18, top: 0, bottom: 0, width: 1, backgroundColor: p.accentSoft },
  pageFooter: { height: 32, backgroundColor: p.surface, borderWidth: 1, borderTopWidth: 0, borderColor: p.line, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, marginBottom: 24 },
});
