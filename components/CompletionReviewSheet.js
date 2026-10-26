import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../ThemeContext';
import { fonts, typeScale, typeLeading } from './typography';
import { Button, Input, Message, Sheet } from './ui';

/** @param {{block: import('../db/StudyBlockService').StudyBlock, busy: boolean, onClose: () => void, onAdd: (topic: string) => Promise<boolean>}} props */
export default function CompletionReviewSheet({ block, busy, onClose, onAdd }) {
  const s = useThemedStyles(createStyles);
  const [editing, setEditing] = useState(false);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function save() {
    if (busy || submitting.current) return;
    if (!topic.trim()) { setError('Enter a review topic.'); return; }
    submitting.current = true; setError(''); Keyboard.dismiss();
    try {
      if (!await onAdd(topic.trim())) setError('Could not add the topic. Try again.');
    } finally { submitting.current = false; }
  }

  return (
    <Sheet title="Add Review Topic" kicker="Session Completed" busy={busy} onClose={onClose}>
      <View style={s.task}>
        <Text style={s.subject}>{block.subject_name}</Text>
        <Text style={s.taskTitle}>{block.task_title}</Text>
      </View>
      <Text style={s.prompt}>Would you like to add a topic from this task to your Review Queue?</Text>
      {editing ? <>
        <Input label="Topic" placeholder="Enter a topic to review" value={topic} onChangeText={setTopic} maxLength={256} editable={!busy} autoFocus returnKeyType="done" onSubmitEditing={() => void save()} />
        <Message text={error} />
        <View style={s.actions}>
          <Button label="Add to Review Queue" busy={busy} onPress={() => void save()} />
          <Button label="Skip" tone="outline" disabled={busy} onPress={onClose} />
        </View>
      </> : <View style={s.actions}>
        <Button label="Yes, Add a Topic" disabled={busy} onPress={() => setEditing(true)} />
        <Button label="No, Finish" tone="outline" disabled={busy} onPress={onClose} />
      </View>}
    </Sheet>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  task: { borderWidth: 1, borderColor: p.line, backgroundColor: p.input, borderRadius: 16, padding: 16, marginBottom: 20 },
  subject: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, marginBottom: 8 },
  taskTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3 },
  prompt: { fontFamily: fonts.body, color: p.text, fontSize: typeScale.body, lineHeight: typeLeading.body, marginBottom: 20 },
  actions: { gap: 12 },
});
