import { fonts, typeScale, typeLeading } from '../components/typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { EmptyState, Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, FieldLabel, Input, Message, Pill } from '../components/ui';
import { firstFieldColor } from '../utils/subjectFields';

/** @type {import('../db/ReviewService').ReviewDifficulty[]} */
const difficulties = ['Hard', 'Good', 'Easy'];

/** @param {{item: import('../db/ReviewService').ReviewItem}} props */
function DueReviewCard({ item }) {
  const { review, disabled, workingReview } = useStudy();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const r = useThemedStyles(createStyles);
  return <View style={s.card}>
    <View style={s.cardTop}><View style={[s.dot, { backgroundColor: subjectColor(item.subject_color) }]} /><Text style={s.subject}>{item.subject_name}</Text></View>
    <Text style={s.title}>{item.topic}</Text>
    <Text style={r.dueDate}>{item.next_review_at ? `Due: ${new Date(item.next_review_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not Reviewed Yet'}</Text>
    <View style={r.ratings}>{difficulties.map(difficulty => <View key={difficulty} style={s.flex}>
      <Button label={difficulty} accessibilityLabel={`Rate ${item.topic} ${difficulty}`}
        compact tone="quiet" disabled={disabled}
        busy={workingReview?.id === item.id && workingReview.difficulty === difficulty}
        onPress={() => void review(item.id, difficulty)} />
    </View>)}</View>
  </View>;
}

export default function ReviewScreen() {
  const { data, refresh, refreshInBackground, disabled, addingReview, addReview, openEntry, demoRevision } = useStudy();
  const [subjectId, setSubjectId] = useState(/** @type {number | null} */ (null));
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const list = useRef(null);
  useScrollToTop(list);
  const s = useThemedStyles(createStudyStyles);
  const r = useThemedStyles(createStyles);
  const selectedSubject = data.subjects.find(subject => subject.id === subjectId) ?? data.subjects[0];

  useEffect(() => { setSubjectId(null); setTopic(''); setError(''); }, [demoRevision]);
  useFocusEffect(useCallback(() => {
    refreshInBackground();
    // An open queue also refreshes when a scheduled review becomes due.
    const interval = setInterval(refreshInBackground, 60_000);
    return () => clearInterval(interval);
  }, [refreshInBackground]));

  async function submit() {
    if (submitting.current || disabled) return;
    if (!selectedSubject) { setError('Create a subject before adding review topics.'); return; }
    if (!topic.trim()) { setError('Enter a review topic.'); return; }
    submitting.current = true; setError(''); Keyboard.dismiss();
    try {
      if (await addReview({ subject_id: selectedSubject.id, topic })) setTopic('');
    } finally { submitting.current = false; }
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={r.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList ref={list} data={data.reviews} contentContainerStyle={s.content} keyExtractor={item => String(item.id)}
        refreshing={data.refreshing && data.ready} onRefresh={refresh} initialNumToRender={6} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={<>
          <ScreenHeader title="Review" edition="Spaced Repetition" subtitle="Add topics and rate your recall to schedule the next review." />
          <View style={s.card}>
            <View style={s.section}><Text style={s.sectionTitle}>Add a Review Topic</Text></View>
            {data.subjects.length > 0 ? <>
              <FieldLabel label="Subject" help="Each review topic belongs to the selected subject." />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={r.subjects}>
                {data.subjects.map(subject => <Pill key={subject.id} label={subject.name} color={firstFieldColor(subject.field_colors)} selected={selectedSubject?.id === subject.id} disabled={disabled} onPress={() => setSubjectId(subject.id)} />)}
              </ScrollView>
              <Input label="Topic" help="Add a concept you want to recall later. New topics are immediately due." placeholder="e.g. Cell division" value={topic} onChangeText={setTopic} maxLength={256} editable={!disabled} returnKeyType="done" onSubmitEditing={() => void submit()} />
              <Message text={error} />
              <Button label="Add to Queue" busy={addingReview} disabled={disabled} onPress={() => void submit()} />
            </> : <View style={r.noSubjects}><Text style={s.hint}>{data.ready ? 'Create a subject before adding topics to the queue.' : 'Loading subjects…'}</Text><Button label="Create Subject" disabled={disabled} onPress={() => openEntry('subject')} /></View>}
          </View>
          <Feedback />
          <View style={s.card}><View style={s.section}><Text style={s.sectionTitle}>Due Reviews</Text><Text style={s.sectionCount}>{data.reviews.length}</Text></View></View>
        </>}
        renderItem={({ item }) => <DueReviewCard item={item} />}
        ListEmptyComponent={<EmptyState title="You're all caught up on reviews." text="New topics appear here immediately. Reviewed topics return at their scheduled time." />} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  keyboard: { flex: 1 },
  subjects: { gap: 12, paddingBottom: 16 }, noSubjects: { gap: 12 },
  dueDate: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, marginTop: 12 },
  ratings: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
