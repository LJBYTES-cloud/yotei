import { useRef, useState } from 'react';
import { createMaterial, updateMaterial } from '../db/MaterialService';
import { Sheet, Input, Button, Message } from './ui';

/** @param {{userId: string, subjectId: number, material?: import('../db/MaterialService').Material, onClose: () => void, onSaved: () => void}} props */
export default function MaterialSheet({ userId, subjectId, material, onClose, onSaved }) {
  const [title, setTitle] = useState(material?.title ?? '');
  const [location, setLocation] = useState(material?.url_or_note || material?.local_file_path || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      if (material) await updateMaterial(userId, material.id, { title, location });
      else await createMaterial(userId, subjectId, { title, location });
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this material. Try again.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Sheet title={material ? 'Edit Material' : 'Add Material'} kicker="Study Materials" busy={busy} onClose={onClose}>
    <Input label="Title" value={title} onChangeText={setTitle} maxLength={256} editable={!busy} />
    <Input label="URL / File Path" help="Save a website or a full file location. Files must be accessible on this device; no files are uploaded." value={location} onChangeText={setLocation} maxLength={4096} editable={!busy} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void save()} />
    <Message text={error} /><Button label="Save Material" busy={busy} onPress={() => void save()} />
  </Sheet>;
}
