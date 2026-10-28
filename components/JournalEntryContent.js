import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { deleteJournalEntry, updateJournalEntry } from '../db/JournalService';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTimeFormat } from '../TimeFormatContext';
import { createStudyStyles } from './studyStyles';
import { Button, Input, Message } from './ui';

/** @param {{userId: string, item: import('../db/JournalService').JournalFeedItem, onSaved: () => void, onDeleted: () => void, onBusyChange?: (busy: boolean) => void}} props */
export default function JournalEntryContent({ userId, item, onSaved, onDeleted, onBusyChange }) {
  const { isDark } = useTheme(), s = useThemedStyles(createStudyStyles);
  const { formatDateTime } = useTimeFormat();
  // Show a successful write immediately, even if the following refresh fails.
  // A new query record takes precedence without an effect-driven render cycle.
  const [savedOverride, setSavedOverride] = useState(/** @type {{source: typeof item, value: typeof item} | null} */ (null));
  const savedItem = savedOverride?.source === item ? savedOverride.value : item;
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(item.title), [content, setContent] = useState(item.content);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), confirming = useRef(false);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  async function save() {
    if (pending.current || confirming.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await updateJournalEntry(userId, item.source_id, { title, content }, item.kind);
      setSavedOverride({ source: item, value: { ...item, title: item.kind === 'entry' ? title.trim() : item.title, content: content.trim() } });
      setEditing(false); onSaved();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this entry. Your draft is still here.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function confirmDelete() {
    if (pending.current || confirming.current) return;
    confirming.current = true; setBusy(true); setError('');
    const cancel = () => { if (!pending.current) { confirming.current = false; setBusy(false); } };
    const remove = async () => {
      if (pending.current || !confirming.current) return;
      pending.current = true;
      try { await deleteJournalEntry(userId, item.source_id, item.kind); onDeleted(); }
      catch { setError('Could not delete this entry. Try again.'); }
      finally { pending.current = false; confirming.current = false; setBusy(false); }
    };
    Alert.alert('Delete Entry', 'Permanently delete this journal entry? Your study sessions and tasks will be kept.', [
      { text: 'Cancel', style: 'cancel', onPress: cancel }, { text: 'Delete', style: 'destructive', onPress: () => { void remove(); } },
    ], { cancelable: true, onDismiss: cancel, userInterfaceStyle: isDark ? 'dark' : 'light' });
  }
  return <View>
    <Text accessibilityRole="header" style={[s.heading, { marginBottom: 24 }]}>{editing ? 'Edit Entry' : savedItem.title}</Text>
    <View style={{ gap: 12, marginBottom: 24 }}>
      {item.subject_name && <Text style={s.subject}>{item.subject_name}</Text>}
      <Text style={s.hint}>{formatDateTime(item.created_at)}</Text>
    </View>
    {editing ? <>
      {item.kind === 'entry' && <Input label="Title" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />}
      <Input label={item.kind === 'entry' ? 'Content' : 'Reflection Note'} value={content} onChangeText={setContent} multiline textAlignVertical="top" style={{ minHeight: 180 }} maxLength={item.kind === 'entry' ? 12000 : 4000} editable={!busy} />
    </> : <Text selectable style={[s.reflectionNote, { marginBottom: 24 }]}>{savedItem.content}</Text>}
    <Message text={error} />
    <View style={{ gap: 12 }}>
      {editing ? <Button label="Save Changes" busy={busy} onPress={() => void save()} /> : <Button label="Edit" disabled={busy} onPress={() => { setTitle(savedItem.title); setContent(savedItem.content); setEditing(true); }} />}
      {editing && <Button label="Cancel Editing" tone="quiet" disabled={busy} onPress={() => { setEditing(false); setError(''); }} />}
      <Button label="Delete" tone="outline" disabled={busy} onPress={confirmDelete} />
    </View>
  </View>;
}
