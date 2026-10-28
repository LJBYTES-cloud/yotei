import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

/** @param {string} userId */
function directoryFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Sign in before adding a file.');
  return new Directory(Paths.document, 'materials', `user-${encodeURIComponent(userId)}`);
}

/** Select one document and copy it out of temporary provider/cache storage.
 * SDK 57's Paths.document is the current equivalent of documentDirectory.
 * @param {string} userId @returns {Promise<{uri: string, name: string} | null>}
 */
export async function pickMaterialFile(userId) {
  const directory = directoryFor(userId);
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('No file was selected.');
  await directory.create({ intermediates: true, idempotent: true });
  const name = (asset.name || 'Document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-140) || 'Document';
  const destination = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`);
  try {
    await new File(asset.uri).copy(destination);
    return { uri: destination.uri, name: asset.name || name };
  } catch (error) {
    try { if (destination.exists) await destination.delete(); } catch { /* Preserve the copy error. */ }
    throw error;
  }
}

/** Remove only an unsaved file created inside this account's private folder.
 * Committed materials and original picker documents never use this cleanup.
 * @param {string} userId @param {string} uri
 */
export async function discardMaterialFile(userId, uri) {
  try {
    const directory = directoryFor(userId), file = new File(uri);
    if (file.uri.startsWith(`${directory.uri.replace(/\/$/, '')}/`) && file.exists) await file.delete();
  } catch { /* Cleanup must not hide a draft/save error. */ }
}
