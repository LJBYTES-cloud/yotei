import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, ScreenHeader, TaskCard } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, Pill } from '../components/ui';

export default function LibraryScreen() {
  const { data, disabled, openEntry, refresh, demoRevision } = useStudy();
  const [subjectId, setSubjectId] = useState(/** @type {number | null} */ (null));
  const list = useRef(/** @type {FlatList<import('../db/TaskService').Task> | null} */ (null));
  useScrollToTop(list);
  const s = useThemedStyles(createStudyStyles);
  const l = useThemedStyles(createStyles);
  useEffect(() => { setSubjectId(null); list.current?.scrollToOffset({ offset: 0, animated: false }); }, [demoRevision]);
  const tasks = useMemo(() => data.tasks.filter(task => subjectId === null || task.subject_id === subjectId), [data.tasks, subjectId]);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList ref={list} data={tasks} keyExtractor={task => String(task.id)} contentContainerStyle={s.content}
        refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6}
        ListHeaderComponent={<>
          <ScreenHeader title="Library" edition="THE COLLECTION" eyebrow="A HOME FOR YOUR LEARNING" subtitle="Gather your subjects. Break big ideas into small, possible steps." />
          <View style={[s.card, l.actions]}>
            <Text style={s.sectionTitle}>Make room for a new idea</Text>
            <Text style={s.hint}>Create a subject, then break it down into tasks.</Text>
            <Button label="＋ New task" disabled={disabled} onPress={() => openEntry(data.subjects.length ? 'task' : 'subject', subjectId)} />
            <Button label="＋ Add subject" tone="outline" disabled={disabled} onPress={() => openEntry('subject')} />
          </View>
          <Feedback />
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Your subjects</Text><Text style={s.sectionCount}>{String(data.subjects.length).padStart(2, '0')}</Text></View>
            {data.subjects.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={l.subjects}>
              <Pill label="All subjects" selected={subjectId === null} onPress={() => setSubjectId(null)} />
              {data.subjects.map(subject => <Pill key={subject.id} label={`${subject.name} · ${data.tasks.filter(task => task.subject_id === subject.id).length}`} color={subject.color} selected={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}
            </ScrollView> : <Text style={s.hint}>Mathematics, a new language, a big curiosity. Give it a home.</Text>}
          </View>
          <View style={s.card}><View style={s.section}><Text style={s.sectionTitle}>Your tasks</Text><Text style={s.sectionCount}>{String(tasks.length).padStart(2, '0')}</Text></View><Text style={s.hint}>Small steps, big things. Schedule a little time for one.</Text></View>
        </>}
        renderItem={({ item }) => <TaskCard task={item} />}
        ListEmptyComponent={<EmptyState title={subjectId ? 'A fresh page.' : 'Start with one thing.'} text={subjectId ? 'Add the first small step for this subject.' : 'Add a subject, then a task. Your next chapter starts small.'} />}
        ListFooterComponent={<Text style={s.footer}>NO PERFECT DAYS REQUIRED.</Text>} />
    </SafeAreaView>
  );
}

const createStyles = () => StyleSheet.create({
  actions: { gap: 12 }, subjects: { gap: 12, paddingBottom: 4 },
});
