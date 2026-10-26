import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, SectionList, Text, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../ThemeContext';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { EmptyState, Feedback, ScreenHeader } from '../components/StudyCards';
import { Button, FieldLabel, Input, Message, Pill } from '../components/ui';
import { firstFieldColor } from '../utils/subjectFields';

export default function ReflectionsScreen() {
  const { data, disabled, addingReflection, addReflection, refresh, refreshInBackground, demoRevision, openEntry } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  const [subjectId, setSubjectId] = useState(/** @type {number | null} */ (null));
  const [note, setNote] = useState(''), [error, setError] = useState('');
  const list = useRef(null), submitting = useRef(false);
  useScrollToTop(list);
  useFocusEffect(useCallback(() => { refreshInBackground(); }, [refreshInBackground]));
  useEffect(() => { setSubjectId(null); setNote(''); setError(''); }, [demoRevision]);
  const subject = data.subjects.find(item => item.id === subjectId) ?? data.subjects[0];
  const sections = useMemo(() => {
    /** @type {Map<number, {id: number, title: string, data: import('../db/ReflectionService').ReflectionItem[]}>} */
    const groups = new Map();
    for (const reflection of data.reflections) {
      if (!groups.has(reflection.subject_id)) groups.set(reflection.subject_id, { id: reflection.subject_id, title: reflection.subject_name, data: [] });
      groups.get(reflection.subject_id)?.data.push(reflection);
    }
    return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [data.reflections]);
  async function save() {
    if (submitting.current || disabled || !subject) return;
    if (!note.trim()) { setError('Enter a reflection note.'); return; }
    submitting.current = true; setError(''); Keyboard.dismiss();
    try { if (await addReflection({ subject_id: subject.id, note: note.trim() })) setNote(''); }
    finally { submitting.current = false; }
  }
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SectionList ref={list} sections={sections} keyExtractor={item => String(item.id)} contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" stickySectionHeadersEnabled={false}
        refreshing={data.ready && data.refreshing} onRefresh={refresh}
        ListHeaderComponent={<>
          <ScreenHeader title="Reflections" edition="Study Journal" subtitle="Record what you learned and what to revisit. Notes are grouped by subject, newest first." />
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Add a Reflection</Text></View>
            {subject ? <>
              <FieldLabel label="Subject" />
              <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                {data.subjects.map(item => <Pill key={item.id} label={item.name} color={firstFieldColor(item.field_colors)} selected={subject.id === item.id} disabled={disabled} onPress={() => setSubjectId(item.id)} />)}
              </ScrollView>
              <Input label="Reflection Note" value={note} onChangeText={setNote} multiline textAlignVertical="top" style={{ minHeight: 120 }} maxLength={4000} editable={!disabled} placeholder="What did you learn?" />
              <Message text={error} /><Button label="Save Reflection" busy={addingReflection} disabled={disabled} onPress={() => void save()} />
            </> : <Button label="Add Subject" disabled={disabled} onPress={() => openEntry('subject')} />}
          </View><Feedback />
        </>}
        renderSectionHeader={({ section }) => <View style={[s.section, { marginTop: 12, marginBottom: 20 }]}><Text style={s.sectionTitle}>{section.title}</Text><Text style={s.sectionCount}>{section.data.length}</Text></View>}
        renderItem={({ item }) => <View style={s.card}>
          <Text style={[s.hint, { marginBottom: 16 }]}>{new Date(item.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          {item.task_title && <Text style={[s.title, { marginBottom: 12 }]}>{item.task_title}</Text>}
          <Text style={s.reflectionNote}>{item.note}</Text>
        </View>}
        ListEmptyComponent={<EmptyState title="No Reflections Yet" text="Save a note here or reflect after finishing a study session." />} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
