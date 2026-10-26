import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createSubject, deleteSubject, updateSubject } from '../db/SubjectService';
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
  { name: 'Black', color: '#000000' },
  { name: 'White', color: '#FFFFFF' },
];

/** @param {{ kind: 'subject' | 'task', userId: string, subjects: import('../db/SubjectService').Subject[], initialSubject?: number | null, editingSubject?: import('../db/SubjectService').Subject | null, onClose: () => void, onSaved: () => void, onDeleted: () => void }} props */
export default function EntrySheet({ kind, userId, subjects, initialSubject, editingSubject = null, onClose, onSaved, onDeleted }) {
  const s = useThemedStyles(createStyles);
  const { colors: p, isDark } = useTheme();
  const subjectToEdit = kind === 'subject' ? editingSubject : null;
  const [name, setName] = useState(subjectToEdit?.name ?? '');
  const [subjectId, setSubjectId] = useState(initialSubject ?? subjects[0]?.id ?? null);
  const [field, setField] = useState(subjectToEdit?.field_of_study ?? '');
  const [colors, setColors] = useState(() => subjectToEdit ? normalizeFieldColors(subjectToEdit.field_colors).split(',') : [subjectColors[0].color]);
  // Imported/legacy colors must remain visible and selectable while editing.
  const storedColors = subjectToEdit ? normalizeFieldColors(subjectToEdit.field_colors).split(',') : [];
  const colorOptions = [...subjectColors, ...storedColors.filter(color => !subjectColors.some(option => option.color === color)).map(color => ({ name: color, color }))];
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const confirmingDelete = useRef(false);
  async function save() {
    if (submitting.current || confirmingDelete.current) return;
    setError('');
    if (!name.trim()) { setError(kind === 'subject' ? 'Enter a subject name.' : 'Enter a task title.'); return; }
    if (kind === 'task' && subjectId === null) { setError('Create a subject before adding a task.'); return; }
    let subjectFields;
    if (kind === 'subject') {
      try { subjectFields = { field_of_study: normalizeFieldOfStudy(field), field_colors: normalizeFieldColors(colors.join(',')) }; }
      catch (validationError) { setError(/** @type {Error} */ (validationError).message); return; }
    }
    submitting.current = true; setBusy(true); setSaving(true);
    try {
      if (kind === 'subject') {
        if (subjectToEdit) await updateSubject(userId, subjectToEdit.id, { name, .../** @type {{field_of_study: string, field_colors: string}} */ (subjectFields) });
        else await createSubject(userId, { name, ...subjectFields });
      }
      else await createTask(userId, { title: name, subject_id: /** @type {number} */ (subjectId) });
      onSaved();
    } catch { setError('We couldn’t save that yet. Your draft is still here; try again.'); }
    finally { submitting.current = false; setBusy(false); setSaving(false); }
  }
  async function removeSubject() {
    if (!subjectToEdit || submitting.current) return;
    submitting.current = true; setDeleting(true); setBusy(true);
    try {
      await deleteSubject(userId, subjectToEdit.id);
      onDeleted();
    } catch { setError('Could not delete this subject. Your data has not changed; try again.'); }
    finally { submitting.current = false; confirmingDelete.current = false; setDeleting(false); setBusy(false); }
  }
  function confirmDelete() {
    if (!subjectToEdit || submitting.current || confirmingDelete.current) return;
    confirmingDelete.current = true; setBusy(true); setError('');
    const cancel = () => {
      if (!submitting.current) { confirmingDelete.current = false; setBusy(false); }
    };
    Alert.alert('Delete Subject', 'Are you sure you want to delete this subject? All associated tasks and reviews will also be permanently deleted.', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Delete', style: 'destructive', onPress: () => { void removeSubject(); } },
    ], { cancelable: true, onDismiss: cancel, userInterfaceStyle: isDark ? 'dark' : 'light' });
  }
  return (
    <Sheet kicker={kind === 'subject' ? 'SUBJECT' : 'TASK'} title={subjectToEdit ? 'Edit subject' : kind === 'subject' ? 'Add subject' : 'Add task'} onClose={onClose} busy={busy}>
      <Input label={kind === 'subject' ? 'Subject name' : 'Task title'} help={kind === 'subject' ? 'Subjects group related tasks and review topics.' : 'After saving, select Schedule in Library to plan this task.'} value={name} onChangeText={setName} placeholder={kind === 'subject' ? 'e.g. Architecture' : 'e.g. Read chapter 3'} maxLength={kind === 'subject' ? 128 : 256} editable={!busy} returnKeyType="done" onSubmitEditing={() => void save()} />
      {kind === 'subject' ? <>
        <Input label="Field of Study" help="Subjects with the same field appear on the same shelf. You can combine fields, such as Biology, Chemistry." value={field} onChangeText={setField} placeholder="e.g. Biology, Chemistry" maxLength={128} editable={!busy} />
        <FieldLabel label="Field colors" help="Choose one or two colors. Select a chosen color to remove it; at least one must remain." />
        <View style={s.colorRow}>{colorOptions.map(option => {
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
      <Button label={subjectToEdit ? 'Save changes' : kind === 'subject' ? 'Create subject ↗' : 'Add task'} disabled={busy} busy={saving} onPress={() => void save()} />
      {subjectToEdit && <Pressable accessibilityRole="button" accessibilityLabel="Delete Subject" accessibilityState={{ disabled: busy, busy: deleting }}
        disabled={busy} onPress={confirmDelete} style={({ pressed }) => [s.deleteButton, busy && s.unavailable, pressed && s.pressed]}>
        {deleting ? <ActivityIndicator color="#FF4C4C" size="small" /> : <Ionicons name="trash-outline" size={18} color="#FF4C4C" />}
        <Text style={s.deleteText}>{deleting ? 'Deleting…' : 'Delete Subject'}</Text>
      </Pressable>}
    </Sheet>
  );
}
/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }, subjects: { gap: 20, paddingBottom: 32 },
  colorChoice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, padding: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12 },
  colorSelected: { borderColor: p.text, backgroundColor: p.raised },
  colorName: { color: p.text, fontSize: 13, fontWeight: '500' },
  swatch: { width: 26, height: 26, flexShrink: 0, borderRadius: 13, borderWidth: 1, borderColor: '#888888' },
  unavailable: { opacity: 0.4 }, pressed: { opacity: 0.75 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, marginTop: 24, padding: 12, borderWidth: 1, borderColor: p.line, borderRadius: 14 },
  deleteText: { color: '#FF4C4C', fontSize: 14, fontWeight: '700' },
});
