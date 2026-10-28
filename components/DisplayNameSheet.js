import { useRef, useState } from 'react';
import { Button, Input, Message, Sheet } from './ui';

/** @param {{name: string, onClose: () => void, onSave: (name: string) => Promise<void>}} props */
export default function DisplayNameSheet({ name, onClose, onSave }) {
  const [draft, setDraft] = useState(name), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  async function save() {
    if (submitting.current) return;
    if (!draft.trim() || draft.trim().length > 128) { setError('Enter a name between 1 and 128 characters.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await onSave(draft.trim()); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update your name. Try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Sheet title="Edit Display Name" kicker="Account" busy={busy} onClose={onClose}>
    <Input label="Display Name" value={draft} onChangeText={setDraft} maxLength={128} editable={!busy} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void save()} />
    <Message text={error} /><Button label="Save Name" busy={busy} onPress={() => void save()} />
  </Sheet>;
}
