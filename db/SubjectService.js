import { getDatabase, requireUserId } from './database';
import { DEFAULT_FIELD, DEFAULT_FIELD_COLORS, DEFAULT_SUBJECT_CODE, normalizeFieldColors, normalizeFieldOfStudy, normalizeSubjectCode } from '../utils/subjectFields';

/** @typedef {{ id: number, user_id: string, name: string, subject_code: string, field_of_study: string, field_colors: string }} Subject */

/**
 * @param {string} userId
 * @param {{ name: string, subject_code?: string, field_of_study?: string, field_colors?: string }} input
 * @returns {Promise<Subject>}
 */
export async function createSubject(userId, { name, subject_code = DEFAULT_SUBJECT_CODE, field_of_study = DEFAULT_FIELD, field_colors = DEFAULT_FIELD_COLORS }) {
  requireUserId(userId);
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 128) {
    throw new Error('Enter a subject name between 1 and 128 characters.');
  }
  const field = normalizeFieldOfStudy(field_of_study);
  const colors = normalizeFieldColors(field_colors);
  const code = normalizeSubjectCode(subject_code);
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT INTO Subject (user_id, name, subject_code, field_of_study, field_colors) VALUES (?, ?, ?, ?, ?)',
    userId, trimmedName, code, field, colors,
  );
  return { id: result.lastInsertRowId, user_id: userId, name: trimmedName, subject_code: code, field_of_study: field, field_colors: colors };
}

/**
 * @param {string} userId
 * @param {number} subjectId
 * @param {{name: string, subject_code?: string, field_of_study: string, field_colors: string}} input
 * @returns {Promise<Subject>}
 */
export async function updateSubject(userId, subjectId, { name, subject_code, field_of_study, field_colors }) {
  requireUserId(userId);
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) throw new Error('Choose a valid subject.');
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 128) throw new Error('Enter a subject name between 1 and 128 characters.');
  const field = normalizeFieldOfStudy(field_of_study);
  const colors = normalizeFieldColors(field_colors);
  const database = await getDatabase();
  const existing = /** @type {{subject_code: string} | null} */ (await database.getFirstAsync('SELECT subject_code FROM Subject WHERE id = ? AND user_id = ?', subjectId, userId));
  if (!existing) throw new Error('Choose a subject belonging to your account.');
  const code = normalizeSubjectCode(subject_code === undefined ? existing.subject_code : subject_code);
  const result = await database.runAsync(
    'UPDATE Subject SET name = ?, subject_code = ?, field_of_study = ?, field_colors = ? WHERE id = ? AND user_id = ?',
    trimmedName, code, field, colors, subjectId, userId,
  );
  if (result.changes !== 1) throw new Error('Choose a subject belonging to your account.');
  return { id: subjectId, user_id: userId, name: trimmedName, subject_code: code, field_of_study: field, field_colors: colors };
}

/** Delete one owned subject; SQLite cascades its linked study data atomically.
 * @param {string} userId @param {number} subjectId @returns {Promise<void>}
 */
export async function deleteSubject(userId, subjectId) {
  requireUserId(userId);
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) throw new Error('Choose a valid subject.');
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM Subject WHERE id = ? AND user_id = ?', subjectId, userId);
  if (result.changes !== 1) throw new Error('Choose a subject belonging to your account.');
}

/** @param {string} userId @returns {Promise<Subject[]>} */
export async function getSubjectsForUser(userId) {
  requireUserId(userId);
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT id, user_id, name, subject_code, field_of_study, field_colors FROM Subject WHERE user_id = ? ORDER BY id ASC',
    userId,
  );
}
