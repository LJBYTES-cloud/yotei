import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

/** @param {string} userId */
function directoryFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Sign in before adding a file.');
  return new Directory(Paths.document, 'materials', `user-${encodeURIComponent(userId)}`);
}

/** @param {Directory} directory @param {string} source @param {string} displayName */
async function copyIntoDirectory(directory, source, displayName) {
  const name = displayName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-140) || 'Document';
  const destination = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`);
  try {
    // Await directory creation before dispatching the native copy.
    await directory.create({ intermediates: true, idempotent: true });
    await FileSystem.copyAsync({ from: source, to: destination.uri });
    return destination.uri;
  } catch (error) {
    try { if (destination.exists) await destination.delete(); } catch { /* Preserve the original copy error. */ }
    throw error;
  }
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
  const name = asset.name || 'Document';
  try {
    // SDK 57's root copyAsync is a throwing deprecation stub. The legacy
    // implementation accepts Android content:// providers without a File wrapper.
    const uri = await copyIntoDirectory(directory, asset.uri, name);
    return { uri, name, copied: true };
  } catch (error) {
    console.warn('[MaterialFiles] Copy failed; keeping the original file reference for saving instead.', error);
    return { uri: asset.uri, name, copied: false };
  }
}

/** expo-sharing on Android requires file:// and cannot accept content:// itself.
 * Keep permanent copies in place; stage provider references in private cache.
 * Do not delete the cache immediately after sharing: the selected app may still
 * be reading it after the chooser closes. The OS manages this cache's lifetime.
 * @param {string} userId @param {string} uri @param {string} [name]
 * @returns {Promise<string>}
 */
export async function getShareableMaterialUri(userId, uri, name = 'Material') {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Sign in before opening a file.');
  if (/^file:\/\//i.test(uri)) return uri;
  if (!/^content:\/\//i.test(uri)) throw new Error('Choose a file or content URI to share.');
  const directory = new Directory(Paths.cache, 'material-sharing', `user-${encodeURIComponent(userId)}`);
  return copyIntoDirectory(directory, uri, name);
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
