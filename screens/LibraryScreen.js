import { memo, useCallback, useMemo, useRef } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { router, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudyList } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button } from '../components/ui';
import SubjectBookshelf from '../components/SubjectBookshelf';
import { groupSubjectsByField } from '../utils/subjectFields';

/** @param {{subjects: import('../db/SubjectService').Subject[], taskCounts: Map<number, number>, disabled: boolean,
 * onAddField: (field: string) => void, onOpen: (subject: import('../db/SubjectService').Subject) => void,
 * onEdit: (subject: import('../db/SubjectService').Subject) => void}} props */
function LibraryShelf(props) {
  const s = useThemedStyles(createStudyStyles);
  return <View style={s.card}><SubjectBookshelf {...props} /></View>;
}

const MemoLibraryShelf = memo(LibraryShelf);

/** @param {{key: string}} field */
const shelfKey = field => field.key;

export default function LibraryScreen() {
  const { data, disabled, openEntry, openEditSubject, refresh } = useStudyList();
  const scroll = useRef(null);
  useScrollToTop(scroll);
  const s = useThemedStyles(createStudyStyles);
  const groups = useMemo(() => groupSubjectsByField(data.subjects), [data.subjects]);
  const addSubject = useCallback(() => openEntry('subject'), [openEntry]);
  const addToField = useCallback((/** @type {string} */ field) => openEntry('subject', null, field), [openEntry]);
  const openBook = useCallback((/** @type {import('../db/SubjectService').Subject} */ subject) => router.push({ pathname: '/library/[subjectId]', params: { subjectId: String(subject.id) } }), []);
  const taskCounts = useMemo(() => {
    const counts = new Map();
    for (const task of data.tasks) counts.set(task.subject_id, (counts.get(task.subject_id) ?? 0) + 1);
    return counts;
  }, [data.tasks]);
  const renderShelf = useCallback((/** @type {import('react-native').ListRenderItemInfo<ReturnType<typeof groupSubjectsByField>[number]>} */ { item }) => <MemoLibraryShelf subjects={item.subjects} taskCounts={taskCounts} disabled={disabled}
    onAddField={addToField} onOpen={openBook} onEdit={openEditSubject} />, [taskCounts, disabled, addToField, openBook, openEditSubject]);
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <FlatList ref={scroll} data={groups} keyExtractor={shelfKey} renderItem={renderShelf} contentContainerStyle={s.content}
      refreshing={data.refreshing && data.ready} onRefresh={refresh}
      initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={Platform.OS === 'android'}
      ListHeaderComponent={<>
      <ScreenHeader title="Library" edition="Subjects" badge={String(data.subjects.length)}
        action={<Button label="Add Subject" compact disabled={disabled} onPress={addSubject} />} />
      <Feedback />
      </>}
      ListEmptyComponent={<EmptyState title="No Books Yet" text="Add a subject to create its book." />} />
  </SafeAreaView>;
}
