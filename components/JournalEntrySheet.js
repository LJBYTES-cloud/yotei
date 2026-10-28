import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { Button, Input, Message, Sheet } from './ui';

/** @param {{busy: boolean, onClose: () => void, onSave: (input: {title: string, content: string}) => Promise<boolean>}} props */
export default function JournalEntrySheet({ busy, onClose, onSave }) {
  const [title, setTitle] = useState(''), [content, setContent] = useState(''), [error, setError] = useState('');
  const saving = useRef(false);
  async function save() {
    if (saving.current || busy) return;
    if (!title.trim() || !content.trim()) { setError('Enter a title and content.'); return; }
    saving.current = true; setError(''); Keyboard.dismiss();
    try { if (!await onSave({ title: title.trim(), content: content.trim() })) setError('Could not save your entry. Your draft is still here; try again.'); }
    finally { saving.current = false; }
  }
  return <Sheet title="New Entry" kicker="Study Journal" busy={busy} onClose={onClose}>
    <Input label="Title" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
    <Input label="Content" multiline textAlignVertical="top" style={{ minHeight: 220, maxHeight: 320 }} value={content} onChangeText={setContent} maxLength={12000} editable={!busy} placeholder="Write your thoughts, plans, or study notes." />
    <Message text={error} /><Button label="Save Entry" busy={busy} onPress={() => void save()} />
  </Sheet>;
}
