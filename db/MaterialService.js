import { getDatabase, requireUserId } from './database';
import { getMaterialUrl } from '../utils/materialLinks';

/** @typedef {{id: number, subject_id: number, task_id: number | null, title: string, url_or_note: string | null, local_file_path: string | null}} Material */
/** @param {number} id */
const requireId = id => { if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose a valid material or subject.'); };
/** @param {{title: string, location: string, local_file_path?: string | null}} input */
function validate({ title, location, local_file_path = null }) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 256) throw new Error('Enter a material title between 1 and 256 characters.');
  getMaterialUrl(location);
  if (local_file_path !== null && (typeof local_file_path !== 'string' || !local_file_path.startsWith('file://') || local_file_path !== location.trim())) throw new Error('Choose a valid saved file.');
  return { title: title.trim(), location: local_file_path ? null : location.trim(), local_file_path };
}
/** @param {string} userId @param {number} subjectId @param {{title: string, location: string, local_file_path?: string | null}} input */
export async function createMaterial(userId, subjectId, input) {
  requireUserId(userId); requireId(subjectId);
  const data = validate(input), db = await getDatabase();
  const result = await db.runAsync(`INSERT INTO Material (subject_id, title, url_or_note, local_file_path)
    SELECT id, ?, ?, ? FROM Subject WHERE id = ? AND user_id = ?`, data.title, data.location, data.local_file_path, subjectId, userId);
  if (result.changes !== 1) throw new Error('Choose a subject belonging to your account.');
  return result.lastInsertRowId;
}
/** @param {string} userId @returns {Promise<Material[]>} */
export async function getMaterialsForUser(userId) {
  requireUserId(userId); const db = await getDatabase();
  return db.getAllAsync(`SELECT m.* FROM Material m JOIN Subject s ON s.id = m.subject_id WHERE s.user_id = ? ORDER BY m.id DESC`, userId);
}
/** @param {string} userId @param {number} materialId @param {{title: string, location: string, local_file_path?: string | null}} input */
export async function updateMaterial(userId, materialId, input) {
  requireUserId(userId); requireId(materialId);
  const data = validate(input), db = await getDatabase();
  const result = await db.runAsync(`UPDATE Material SET title = ?, url_or_note = ?, local_file_path = ?
    WHERE id = ? AND subject_id IN (SELECT id FROM Subject WHERE user_id = ?)`, data.title, data.location, data.local_file_path, materialId, userId);
  if (result.changes !== 1) throw new Error('Choose a material belonging to your account.');
}
/** @param {string} userId @param {number} materialId */
export async function deleteMaterial(userId, materialId) {
  requireUserId(userId); requireId(materialId); const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM Material WHERE id = ? AND subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', materialId, userId);
  if (result.changes !== 1) throw new Error('Choose a material belonging to your account.');
}
