import { useRef, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { useThemedStyles } from '../ThemeContext';
import { createStudyStyles } from './studyStyles';
import { Button, Input, Message, Sheet } from './ui';

/** @param {{block: import('../db/StudyBlockService').StudyBlock, busy: boolean, onClose: () => void, onAdd: (note: string) => Promise<boolean>}} props */
export default function CompletionReflectionSheet({ block, busy, onClose, onAdd }) {
  const s = useThemedStyles(createStudyStyles);
  const [note, setNote] = useState(''), [error, setError] = useState('');
  const submitting = useRef(false);
  async function save() {
    if (busy || submitting.current) return;
    if (!note.trim()) { setError('Enter a reflection or choose Skip.'); return; }
    submitting.current = true; setError(''); Keyboard.dismiss();
    try { if (!await onAdd(note.trim())) setError('Could not save your reflection. Your note is still here; try again.'); }
    finally { submitting.current = false; }
  }
  return <Sheet title="Reflect on This Session" kicker="Session Completed" busy={busy} onClose={onClose}>
    <View style={{ gap: 12, marginBottom: 24 }}><Text style={s.subject}>{block.subject_name}</Text><Text style={s.title}>{block.task_title}</Text><Text style={s.hint}>Reflect on this session.</Text></View>
    <Input label="Reflection Note" multiline textAlignVertical="top" style={{ minHeight: 140 }} placeholder="What did you learn? What needs more practice?" value={note} onChangeText={setNote} maxLength={4000} editable={!busy} />
    <Message text={error} /><View style={{ gap: 12 }}><Button label="Save Reflection" busy={busy} onPress={() => void save()} /><Button label="Skip" tone="outline" disabled={busy} onPress={onClose} /></View>
  </Sheet>;
}
