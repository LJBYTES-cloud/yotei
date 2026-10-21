import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createSubject } from '../db/SubjectService';
import { createTask } from '../db/TaskService';
import { Button, FieldLabel, Input, Message, Pill, Sheet } from './ui';
import { useTheme, useThemedStyles } from '../ThemeContext';

const subjectColors = [
  { name: 'Iris', color: '#C2ACF3' },
  { name: 'Violet', color: '#A78BFA' },
  { name: 'Blue', color: '#60A5FA' },
  { name: 'Cyan', color: '#22D3EE' },
  { name: 'Teal', color: '#2DD4BF' },
  { name: 'Lime', color: '#A3E635' },
  { name: 'Amber', color: '#FBBF24' },
  { name: 'Orange', color: '#FB923C' },
  { name: 'Rose', color: '#FB7185' },
  { name: 'Pink', color: '#F472B6' },
];

/** @param {{ kind: 'subject' | 'task', userId: string, subjects: import('../db/SubjectService').Subject[], initialSubject?: number | null, onClose: () => void, onSaved: () => void }} props */
export default function EntrySheet({ kind, userId, subjects, initialSubject, onClose, onSaved }) {
  const s = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubject ?? subjects[0]?.id ?? null);
  // Preserve a dark-mode color even when the subject is created in light mode.
  const [color, setColor] = useState(subjectColors[0].color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function save() {
    if (submitting.current) return;
    setError('');
    if (!name.trim()) { setError(kind === 'subject' ? 'Enter a subject name.' : 'Enter a task title.'); return; }
    if (kind === 'task' && subjectId === null) { setError('Create a subject before adding a task.'); return; }
    submitting.current = true; setBusy(true);
    try {
      if (kind === 'subject') await createSubject(userId, { name, color });
      else await createTask(userId, { title: name, subject_id: /** @type {number} */ (subjectId) });
      onSaved();
    } catch { setError('We couldn’t save that yet. Your draft is still here; try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return (
    <Sheet kicker={kind === 'subject' ? 'SUBJECT' : 'TASK'} title={kind === 'subject' ? 'Add subject' : 'Add task'} onClose={onClose} busy={busy}>
      <Input label={kind === 'subject' ? 'Subject name' : 'Task title'} help={kind === 'subject' ? 'Subjects group related tasks and review topics.' : 'After saving, select Schedule in Library to plan this task.'} value={name} onChangeText={setName} placeholder={kind === 'subject' ? 'e.g. Architecture' : 'e.g. Read chapter 3'} maxLength={kind === 'subject' ? 128 : 256} editable={!busy} returnKeyType="done" onSubmitEditing={() => void save()} />
      {kind === 'subject' ? isDark && <>
        <FieldLabel label="Subject color" help="This color identifies the subject on your bookshelf." />
        <View style={s.colorRow}>{subjectColors.map(option => <Pill key={option.color} label={option.name} color={option.color} selected={color === option.color} disabled={busy} onPress={() => setColor(option.color)} />)}</View>
      </> : <>
        <FieldLabel label="Subject" help="The task and its review topics belong to this subject." />
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjects}>{subjects.map(subject => <Pill key={subject.id} label={subject.name} color={subject.color} selected={subjectId === subject.id} disabled={busy} onPress={() => setSubjectId(subject.id)} />)}</ScrollView>
      </>}
      <Message text={error} />
      <Button label={kind === 'subject' ? 'Create subject ↗' : 'Add task'} busy={busy} onPress={() => void save()} />
    </Sheet>
  );
}
const createStyles = () => StyleSheet.create({
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 32 }, subjects: { gap: 20, paddingBottom: 32 },
});
