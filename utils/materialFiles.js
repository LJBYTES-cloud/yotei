import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

/** @param {string} userId */
function directoryFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Sign in before adding a file.');
  return new Directory(Paths.document, 'materials', `user-${encodeURIComponent(userId)}`);
}

/** Select one document, preferring a private copy; retain its reference on failure.
 * SDK 57's Paths.document is the current equivalent of documentDirectory.
 * @param {string} userId @returns {Promise<{uri: string, name: string, copied: boolean} | null>}
 */
export async function pickMaterialFile(userId) {
  const directory = directoryFor(userId);
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('No file was selected.');
  const name = (asset.name || 'Document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-140) || 'Document';
  const destination = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`);
  try {
    await directory.create({ intermediates: true, idempotent: true });
    // SDK 57's root copyAsync is a throwing deprecation stub. The legacy
    // implementation accepts Android content:// providers without a File wrapper.
    await FileSystem.copyAsync({ from: asset.uri, to: destination.uri });
    return { uri: destination.uri, name: asset.name || name, copied: true };
  } catch (error) {
    try { if (destination.exists) await destination.delete(); } catch { /* Keep the original provider reference usable. */ }
    console.warn('[MaterialFiles] Copy failed; keeping the original file reference for saving instead.', error);
    return { uri: asset.uri, name: asset.name || name, copied: false };
  }
}

/** Remove only an unsaved file created inside this account's private folder.
 * Committed materials and original picker documents never use this cleanup.
 * @param {string} userId @param {string} uri
 */
export async function discardMaterialFile(userId, uri) {
  try {
    const directory = directoryFor(userId);
    const prefix = `${directory.uri.replace(/\/$/, '')}/`;
    // Provider/cache references are never ours to delete or construct as File.
    if (!uri.startsWith(prefix)) return;
    const file = new File(uri);
    if (file.uri.startsWith(prefix) && file.exists) await file.delete();
  } catch { /* Cleanup must not hide a draft/save error. */ }
}
