import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, ScreenHeader, TaskCard } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button } from '../components/ui';
import SubjectBookshelf from '../components/SubjectBookshelf';

export default function LibraryScreen() {
  const { data, disabled, openEntry, refresh, demoRevision } = useStudy();
  const [subjectId, setSubjectId] = useState(/** @type {number | null} */ (null));
  const list = useRef(/** @type {FlatList<import('../db/TaskService').Task> | null} */ (null));
  useScrollToTop(list);
  const s = useThemedStyles(createStudyStyles);
  const l = useThemedStyles(createStyles);
  useEffect(() => { setSubjectId(null); list.current?.scrollToOffset({ offset: 0, animated: false }); }, [demoRevision]);
  const tasks = useMemo(() => data.tasks.filter(task => subjectId === null || task.subject_id === subjectId), [data.tasks, subjectId]);
  const taskCounts = useMemo(() => {
    const counts = new Map();
    for (const task of data.tasks) counts.set(task.subject_id, (counts.get(task.subject_id) ?? 0) + 1);
    return counts;
  }, [data.tasks]);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList ref={list} data={tasks} keyExtractor={task => String(task.id)} contentContainerStyle={s.content}
        refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6}
        ListHeaderComponent={<>
          <ScreenHeader title="Library" edition="SUBJECTS & TASKS" subtitle="Create subjects and tasks, then schedule study sessions." />
          <View style={[s.card, l.actions]}>
            <Text style={s.sectionTitle}>Add study content</Text>
            <Text style={s.hint}>Create a subject before adding tasks.</Text>
            <Button label="＋ New task" disabled={disabled} onPress={() => openEntry(data.subjects.length ? 'task' : 'subject', subjectId)} />
            <Button label="＋ Add subject" tone="outline" disabled={disabled} onPress={() => openEntry('subject')} />
          </View>
          <Feedback />
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Subject bookshelf</Text><Text style={s.sectionCount}>{String(data.subjects.length).padStart(2, '0')}</Text></View>
            {data.subjects.length ? <SubjectBookshelf subjects={data.subjects} taskCounts={taskCounts} selectedId={subjectId}
              disabled={disabled} onSelect={setSubjectId} /> : <Text style={s.hint}>No subjects added.</Text>}
          </View>
          <View style={s.card}><View style={s.section}><Text style={s.sectionTitle}>Your tasks</Text><Text style={s.sectionCount}>{String(tasks.length).padStart(2, '0')}</Text></View><Text style={s.hint}>Select Schedule on a task to create a study session.</Text></View>
        </>}
        renderItem={({ item }) => <TaskCard task={item} />}
        ListEmptyComponent={<EmptyState title={subjectId ? 'No tasks in this subject' : 'No tasks added'} text={subjectId ? 'Add a task to this subject.' : 'Create a subject and add a task to start scheduling.'} />} />
    </SafeAreaView>
  );
}

const createStyles = () => StyleSheet.create({
  actions: { gap: 24 },
});
