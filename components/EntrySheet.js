import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createSubject } from '../db/SubjectService';
import { createTask } from '../db/TaskService';
import { Button, FieldLabel, Input, Message, Pill, Sheet } from './ui';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { firstFieldColor, normalizeFieldColors, normalizeFieldOfStudy } from '../utils/subjectFields';

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
  const { colors: p } = useTheme();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubject ?? subjects[0]?.id ?? null);
  const [field, setField] = useState('');
  const [colors, setColors] = useState([subjectColors[0].color]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function save() {
    if (submitting.current) return;
    setError('');
    if (!name.trim()) { setError(kind === 'subject' ? 'Enter a subject name.' : 'Enter a task title.'); return; }
    if (kind === 'task' && subjectId === null) { setError('Create a subject before adding a task.'); return; }
    let subjectFields;
    if (kind === 'subject') {
      try { subjectFields = { field_of_study: normalizeFieldOfStudy(field), field_colors: normalizeFieldColors(colors.join(',')) }; }
      catch (validationError) { setError(/** @type {Error} */ (validationError).message); return; }
    }
    submitting.current = true; setBusy(true);
    try {
      if (kind === 'subject') await createSubject(userId, { name, ...subjectFields });
      else await createTask(userId, { title: name, subject_id: /** @type {number} */ (subjectId) });
      onSaved();
    } catch { setError('We couldn’t save that yet. Your draft is still here; try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return (
    <Sheet kicker={kind === 'subject' ? 'SUBJECT' : 'TASK'} title={kind === 'subject' ? 'Add subject' : 'Add task'} onClose={onClose} busy={busy}>
      <Input label={kind === 'subject' ? 'Subject name' : 'Task title'} help={kind === 'subject' ? 'Subjects group related tasks and review topics.' : 'After saving, select Schedule in Library to plan this task.'} value={name} onChangeText={setName} placeholder={kind === 'subject' ? 'e.g. Architecture' : 'e.g. Read chapter 3'} maxLength={kind === 'subject' ? 128 : 256} editable={!busy} returnKeyType="done" onSubmitEditing={() => void save()} />
      {kind === 'subject' ? <>
        <Input label="Field of Study" help="Subjects with the same field appear on the same shelf. You can combine fields, such as Biology, Chemistry." value={field} onChangeText={setField} placeholder="e.g. Biology, Chemistry" maxLength={128} editable={!busy} />
        <FieldLabel label="Field colors" help="Choose one or two colors. Select a chosen color to remove it; at least one must remain." />
        <View style={s.colorRow}>{subjectColors.map(option => {
          const selected = colors.includes(option.color);
          const unavailable = busy || (!selected && colors.length === 2);
          return <Pressable key={option.color} accessibilityRole="checkbox" accessibilityLabel={option.name}
            accessibilityState={{ checked: selected, disabled: unavailable }} disabled={unavailable}
            onPress={() => setColors(current => selected ? (current.length > 1 ? current.filter(color => color !== option.color) : current) : [...current, option.color])}
            style={({ pressed }) => [s.colorChoice, selected && s.colorSelected, unavailable && s.unavailable, pressed && s.pressed]}>
            <View style={[s.swatch, { backgroundColor: option.color }]} /><Text style={s.colorName}>{option.name}</Text>
            {selected && <Ionicons name="checkmark" color={p.text} size={16} />}
          </Pressable>;
        })}</View>
      </> : <>
        <FieldLabel label="Subject" help="The task and its review topics belong to this subject." />
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjects}>{subjects.map(subject => <Pill key={subject.id} label={subject.name} color={firstFieldColor(subject.field_colors)} selected={subjectId === subject.id} disabled={busy} onPress={() => setSubjectId(subject.id)} />)}</ScrollView>
      </>}
      <Message text={error} />
      <Button label={kind === 'subject' ? 'Create subject ↗' : 'Add task'} busy={busy} onPress={() => void save()} />
    </Sheet>
  );
}
/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }, subjects: { gap: 20, paddingBottom: 32 },
  colorChoice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, padding: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12 },
  colorSelected: { borderColor: p.text, backgroundColor: p.raised },
  colorName: { color: p.text, fontSize: 13, fontWeight: '500' }, swatch: { width: 18, height: 18, borderRadius: 9 },
  unavailable: { opacity: 0.4 }, pressed: { opacity: 0.75 },
});
