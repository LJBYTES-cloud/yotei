import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createSubject } from '../db/SubjectService';
import { createTask } from '../db/TaskService';
import { Button, Input, Message, Pill, Sheet } from './ui';
import { palette as p } from './theme';

/** @param {{ kind: 'subject' | 'task', userId: string, subjects: import('../db/SubjectService').Subject[], initialSubject?: number | null, onClose: () => void, onSaved: () => void }} props */
export default function EntrySheet({ kind, userId, subjects, initialSubject, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubject ?? subjects[0]?.id ?? null);
  const [color, setColor] = useState(p.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function save() {
    if (submitting.current) return;
    setError('');
    if (!name.trim()) { setError(kind === 'subject' ? 'Give your subject a name.' : 'What’s the next small step? Add a title.'); return; }
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
    <Sheet kicker={kind === 'subject' ? 'GIVE YOUR LEARNING A HOME' : 'ONE SMALL STEP'} title={kind === 'subject' ? 'A new subject.' : 'What’s on your mind?'} onClose={onClose} busy={busy}>
      <Input label={kind === 'subject' ? 'Subject name' : 'Task title'} value={name} onChangeText={setName} placeholder={kind === 'subject' ? 'e.g. Architecture' : 'e.g. Sketch the first three ideas'} maxLength={kind === 'subject' ? 128 : 256} editable={!busy} returnKeyType="done" onSubmitEditing={() => void save()} />
      <Text style={s.label}>{kind === 'subject' ? 'A color to call its own' : 'Choose a subject'}</Text>
      {kind === 'subject' ? (
        <View style={s.colorRow}>{[p.accent, '#B0CDBD', '#EAC68D', '#E7A8A6', '#99BCE5'].map((value, index) => <Pill key={value} label={['Iris', 'Sage', 'Honey', 'Rose', 'Sky'][index]} color={value} selected={color === value} disabled={busy} onPress={() => setColor(value)} />)}</View>
      ) : <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjects}>{subjects.map(subject => <Pill key={subject.id} label={subject.name} color={subject.color} selected={subjectId === subject.id} disabled={busy} onPress={() => setSubjectId(subject.id)} />)}</ScrollView>}
      <Message text={error} />
      <Button label={kind === 'subject' ? 'Create subject ↗' : 'Add to my list ↗'} busy={busy} onPress={() => void save()} />
      <Text style={s.note}>{kind === 'subject' ? 'A little organization. A clearer head.' : 'Keep it small enough that starting feels possible.'}</Text>
    </Sheet>
  );
}
const s = StyleSheet.create({
  label: { color: p.muted, fontSize: 12, fontWeight: '600', marginBottom: 12 }, colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }, subjects: { gap: 8, paddingBottom: 24 },
  note: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 18, textAlign: 'center' },
});
