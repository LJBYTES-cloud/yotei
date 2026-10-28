import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { createMaterial, updateMaterial } from '../db/MaterialService';
import { pickMaterialFile, discardMaterialFile } from '../utils/materialFiles';
import { getMaterialUrl } from '../utils/materialLinks';
import { useThemedStyles } from '../ThemeContext';
import { createStudyStyles } from './studyStyles';
import { Sheet, Input, Button, Message } from './ui';

/** @param {{userId: string, subjectId: number, material?: import('../db/MaterialService').Material, onClose: () => void, onSaved: () => void}} props */
export default function MaterialSheet({ userId, subjectId, material, onClose, onSaved }) {
  const s = useThemedStyles(createStudyStyles);
  const [title, setTitle] = useState(material?.title ?? '');
  const [url, setUrl] = useState(material?.url_or_note || material?.local_file_path || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [localFile, setLocalFile] = useState(material?.local_file_path ?? null);
  const [pickedReference, setPickedReference] = useState(/^content:\/\//i.test(material?.url_or_note ?? ''));
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
      if (!alive.current) { if (picked.copied) await discardMaterialFile(userId, picked.uri); return; }
      if (pendingFile.current) await discardMaterialFile(userId, pendingFile.current);
      pendingFile.current = picked.copied ? picked.uri : null;
      setUrl(picked.uri); setLocalFile(picked.copied ? picked.uri : null); setPickedReference(!picked.copied); setManual(false);
      setTitle(current => current.trim() ? current : picked.name);
    } catch { if (alive.current) setError('Could not select that file. Open the file manager and try again.'); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      // Only manual drafts need URL/path validation here. The service accepts
      // opaque content:// references without misclassifying them as local copies.
      if (!localFile && !pickedReference) {
        if (url.length > 4096) throw new Error('Enter a URL or an absolute file path under 4,096 characters.');
        getMaterialUrl(url);
      }
      const input = { title, location: url, local_file_path: localFile === url ? localFile : null };
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
      {pickedReference && <Text style={s.hint}>File Reference Selected</Text>}
    </View>
    <Input label="Title" value={title} onChangeText={setTitle} maxLength={256} editable={!busy} />
    <View style={{ marginBottom: 24 }}><Button label={manual ? 'Hide Manual Input' : 'Use URL / File Path'} tone="quiet" disabled={busy} onPress={() => setManual(value => !value)} /></View>
    {manual && <Input label="URL / File Path (Optional)" help="Use a website or an existing file location instead of picking a document." value={url} onChangeText={value => { setUrl(value); setLocalFile(null); setPickedReference(false); setError(''); }} maxLength={4096} editable={!busy} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void save()} />}
    <Message text={error} /><Button label="Save Material" tone="outline" busy={busy} onPress={() => void save()} />
  </Sheet>;
}
