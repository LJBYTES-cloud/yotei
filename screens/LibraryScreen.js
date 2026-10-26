import { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, FieldLabel } from '../components/ui';
import SubjectBookshelf from '../components/SubjectBookshelf';

export default function LibraryScreen() {
  const { data, disabled, openEntry, openEditSubject, refresh } = useStudy();
  const { colors } = useTheme();
  const scroll = useRef(null);
  useScrollToTop(scroll);
  const s = useThemedStyles(createStudyStyles);
  const taskCounts = useMemo(() => {
    const counts = new Map();
    for (const task of data.tasks) counts.set(task.subject_id, (counts.get(task.subject_id) ?? 0) + 1);
    return counts;
  }, [data.tasks]);
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <ScrollView ref={scroll} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={data.refreshing && data.ready} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}>
      <ScreenHeader title="Library" edition="Subjects" subtitle="Choose a book to open its subject notebook." />
      <Feedback />
      <View style={s.card}>
        <View style={s.section}><FieldLabel label="Bookshelf" textStyle={s.sectionTitle} help="Tap a spine to reveal its cover. Open the cover to see that subject's tasks, or use its pencil to edit." /><Text style={s.sectionCount}>{data.subjects.length}</Text></View>
        {data.subjects.length > 0 ? <SubjectBookshelf subjects={data.subjects} taskCounts={taskCounts} disabled={disabled} onAddField={field => openEntry('subject', null, field)}
          onOpen={subject => router.push({ pathname: '/library/[subjectId]', params: { subjectId: String(subject.id) } })} onEdit={openEditSubject} />
          : <EmptyState title="No Books Yet" text="Add a subject to create its book." />}
      </View>
      <Button label="Add Subject" disabled={disabled} onPress={() => openEntry('subject')} />
    </ScrollView>
  </SafeAreaView>;
}
