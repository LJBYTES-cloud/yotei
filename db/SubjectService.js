import { getDatabase, requireUserId } from './database';
import { DEFAULT_FIELD, DEFAULT_FIELD_COLORS, normalizeFieldColors, normalizeFieldOfStudy } from '../utils/subjectFields';

/** @typedef {{ id: number, user_id: string, name: string, field_of_study: string, field_colors: string }} Subject */

/**
 * @param {string} userId
 * @param {{ name: string, field_of_study?: string, field_colors?: string }} input
 * @returns {Promise<Subject>}
 */
export async function createSubject(userId, { name, field_of_study = DEFAULT_FIELD, field_colors = DEFAULT_FIELD_COLORS }) {
  requireUserId(userId);
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 128) {
    throw new Error('Enter a subject name between 1 and 128 characters.');
  }
  const field = normalizeFieldOfStudy(field_of_study);
  const colors = normalizeFieldColors(field_colors);
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT INTO Subject (user_id, name, field_of_study, field_colors) VALUES (?, ?, ?, ?)',
    userId, trimmedName, field, colors,
  );
  return { id: result.lastInsertRowId, user_id: userId, name: trimmedName, field_of_study: field, field_colors: colors };
}

/**
 * @param {string} userId
 * @param {number} subjectId
 * @param {{name: string, field_of_study: string, field_colors: string}} input
 * @returns {Promise<Subject>}
 */
export async function updateSubject(userId, subjectId, { name, field_of_study, field_colors }) {
  requireUserId(userId);
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) throw new Error('Choose a valid subject.');
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 128) throw new Error('Enter a subject name between 1 and 128 characters.');
  const field = normalizeFieldOfStudy(field_of_study);
  const colors = normalizeFieldColors(field_colors);
  const database = await getDatabase();
  const result = await database.runAsync(
    'UPDATE Subject SET name = ?, field_of_study = ?, field_colors = ? WHERE id = ? AND user_id = ?',
    trimmedName, field, colors, subjectId, userId,
  );
  if (result.changes !== 1) throw new Error('Choose a subject belonging to your account.');
  return { id: subjectId, user_id: userId, name: trimmedName, field_of_study: field, field_colors: colors };
}

/** @param {string} userId @returns {Promise<Subject[]>} */
export async function getSubjectsForUser(userId) {
  requireUserId(userId);
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT id, user_id, name, field_of_study, field_colors FROM Subject WHERE user_id = ? ORDER BY id ASC',
    userId,
  );
}
