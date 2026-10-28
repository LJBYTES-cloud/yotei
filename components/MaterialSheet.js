import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { createMaterial, updateMaterial } from '../db/MaterialService';
import { pickMaterialFile, discardMaterialFile } from '../utils/materialFiles';
import { useThemedStyles } from '../ThemeContext';
import { createStudyStyles } from './studyStyles';
import { Sheet, Input, Button, Message } from './ui';

/** @param {{userId: string, subjectId: number, material?: import('../db/MaterialService').Material, onClose: () => void, onSaved: () => void}} props */
export default function MaterialSheet({ userId, subjectId, material, onClose, onSaved }) {
  const s = useThemedStyles(createStudyStyles);
  const [title, setTitle] = useState(material?.title ?? '');
  const [location, setLocation] = useState(material?.url_or_note || material?.local_file_path || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [localFile, setLocalFile] = useState(material?.local_file_path ?? null);
  const [manual, setManual] = useState(Boolean(material?.url_or_note));
  const saving = useRef(false);
  const pendingFile = useRef(/** @type {string | null} */ (null)), committed = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (pendingFile.current && !committed.current) void discardMaterialFile(userId, pendingFile.current); };
  }, [userId]);
  async function browse() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const picked = await pickMaterialFile(userId);
      if (!picked) return;
      if (!alive.current) { await discardMaterialFile(userId, picked.uri); return; }
      if (pendingFile.current) await discardMaterialFile(userId, pendingFile.current);
      pendingFile.current = picked.uri;
      setLocation(picked.uri); setLocalFile(picked.uri); setManual(false);
      setTitle(current => current.trim() ? current : picked.name);
    } catch { if (alive.current) setError('Could not copy that file. Check storage access and try again.'); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const input = { title, location, local_file_path: localFile === location ? localFile : null };
      if (material) await updateMaterial(userId, material.id, input);
      else await createMaterial(userId, subjectId, input);
      committed.current = true;
      if (pendingFile.current && pendingFile.current !== input.local_file_path) await discardMaterialFile(userId, pendingFile.current);
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this material. Try again.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Sheet title={material ? 'Edit Material' : 'Add Material'} kicker="Study Materials" busy={busy} onClose={onClose}>
    <View style={{ gap: 16, marginBottom: 24 }}>
      <Button label="Browse File Manager" busy={busy} onPress={() => void browse()} />
      {localFile && <Text style={s.hint}>File Saved to App Storage</Text>}
    </View>
    <Input label="Title" value={title} onChangeText={setTitle} maxLength={256} editable={!busy} />
    <View style={{ marginBottom: 24 }}><Button label={manual ? 'Hide Manual Input' : 'Use URL / File Path'} tone="quiet" disabled={busy} onPress={() => setManual(value => !value)} /></View>
    {manual && <Input label="URL / File Path (Optional)" help="Use a website or an existing file location instead of picking a document." value={location} onChangeText={value => { setLocation(value); setLocalFile(null); }} maxLength={4096} editable={!busy} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void save()} />}
    <Message text={error} /><Button label="Save Material" tone="outline" busy={busy} onPress={() => void save()} />
  </Sheet>;
}
