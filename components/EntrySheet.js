import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createSubject } from '../db/SubjectService';
import { createTask } from '../db/TaskService';
import { Button, Input, Message, Pill, Sheet } from './ui';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** @param {{ kind: 'subject' | 'task', userId: string, subjects: import('../db/SubjectService').Subject[], initialSubject?: number | null, onClose: () => void, onSaved: () => void }} props */
export default function EntrySheet({ kind, userId, subjects, initialSubject, onClose, onSaved }) {
  const s = useThemedStyles(createStyles);
  const { colors: p, isDark } = useTheme();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubject ?? subjects[0]?.id ?? null);
  const [color, setColor] = useState(p.accent);
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
      <Input label={kind === 'subject' ? 'Subject name' : 'Task title'} value={name} onChangeText={setName} placeholder={kind === 'subject' ? 'e.g. Architecture' : 'e.g. Read chapter 3'} maxLength={kind === 'subject' ? 128 : 256} editable={!busy} returnKeyType="done" onSubmitEditing={() => void save()} />
      <Text style={s.label}>{kind === 'subject' ? 'Subject color' : 'Choose a subject'}</Text>
      {kind === 'subject' ? (
        <View style={s.colorRow}>{(isDark ? [p.accent, '#B0CDBD', '#EAC68D', '#E7A8A6', '#99BCE5'] : [p.accent, '#444444', '#777777', '#999999', '#BBBBBB']).map((value, index) => <Pill key={value} label={(isDark ? ['Iris', 'Sage', 'Honey', 'Rose', 'Sky'] : ['Ink', 'Charcoal', 'Graphite', 'Silver', 'Stone'])[index]} color={value} selected={color === value} disabled={busy} onPress={() => setColor(value)} />)}</View>
      ) : <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjects}>{subjects.map(subject => <Pill key={subject.id} label={subject.name} color={subject.color} selected={subjectId === subject.id} disabled={busy} onPress={() => setSubjectId(subject.id)} />)}</ScrollView>}
      <Message text={error} />
      <Button label={kind === 'subject' ? 'Create subject ↗' : 'Add task'} busy={busy} onPress={() => void save()} />
      <Text style={s.note}>{kind === 'subject' ? 'Subjects group related tasks and review topics.' : 'Schedule this task from Library.'}</Text>
    </Sheet>
  );
}
/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  label: { color: p.muted, fontSize: 12, fontWeight: '600', marginBottom: 12 }, colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }, subjects: { gap: 12, paddingBottom: 24 },
  note: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 18, textAlign: 'center' },
});
