import { getDatabase, requireUserId } from './database';

/** @typedef {{ id: number, user_id: string, name: string, color: string }} Subject */

/**
 * @param {string} userId
 * @param {{ name: string, color?: string }} input
 * @returns {Promise<Subject>}
 */
export async function createSubject(userId, { name, color = '#B8A0F5' }) {
  requireUserId(userId);
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 128) {
    throw new Error('Enter a subject name between 1 and 128 characters.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error('Use a six-digit hex color for your subject.');
  }
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT INTO Subject (user_id, name, color) VALUES (?, ?, ?)',
    userId, trimmedName, color,
  );
  return { id: result.lastInsertRowId, user_id: userId, name: trimmedName, color };
}

/** @param {string} userId @returns {Promise<Subject[]>} */
export async function getSubjectsForUser(userId) {
  requireUserId(userId);
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT id, user_id, name, color FROM Subject WHERE user_id = ? ORDER BY id ASC',
    userId,
  );
}
