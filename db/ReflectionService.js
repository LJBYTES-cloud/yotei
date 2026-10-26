import { getDatabase, requireUserId } from './database';
import { firstFieldColor } from '../utils/subjectFields';

/** @typedef {{id: number, subject_id: number, study_block_id: number | null, note: string, created_at: string, subject_name: string, subject_color: string, task_title: string | null}} ReflectionItem */
/** @param {string} userId @param {{subject_id: number, study_block_id?: number | null, note: string}} input @returns {Promise<ReflectionItem>} */
export async function createReflectionItem(userId, { subject_id, study_block_id = null, note }) {
  requireUserId(userId);
  if (!Number.isSafeInteger(subject_id) || subject_id < 1) throw new Error('Choose a subject for this reflection.');
  if (typeof note !== 'string' || !note.trim() || note.length > 4000) throw new Error('Enter a reflection between 1 and 4,000 characters.');
  if (study_block_id !== null && (!Number.isSafeInteger(study_block_id) || study_block_id < 1)) throw new Error('Choose a valid completed session.');
  const db = await getDatabase();
  // Resolve all descriptive data before the insert, so a failed read cannot
  // report an already-created note as unsaved and invite a duplicate retry.
  const subject = /** @type {{name: string, field_colors: string} | null} */ (await db.getFirstAsync('SELECT name, field_colors FROM Subject WHERE id = ? AND user_id = ?', subject_id, userId));
  if (!subject) throw new Error('Choose a subject belonging to your account.');
  let title = /** @type {string | null} */ (null);
  if (study_block_id !== null) {
    const block = /** @type {{title: string} | null} */ (await db.getFirstAsync(`SELECT t.title FROM StudyBlock b JOIN Task t ON t.id = b.task_id
      WHERE b.id = ? AND t.user_id = ? AND t.subject_id = ? AND b.status = 'done'`, study_block_id, userId, subject_id));
    if (!block) throw new Error('Choose a completed session from this subject.');
    title = block.title;
  }
  const created_at = new Date().toISOString();
  const result = await db.runAsync(`INSERT INTO ReflectionItem (subject_id, study_block_id, note, created_at)
    SELECT id, ?, ?, ? FROM Subject WHERE id = ? AND user_id = ?`, study_block_id, note.trim(), created_at, subject_id, userId);
  if (result.changes !== 1) throw new Error('This subject is no longer available.');
  return { id: result.lastInsertRowId, subject_id, study_block_id, note: note.trim(), created_at,
    subject_name: subject.name, subject_color: firstFieldColor(subject.field_colors), task_title: title };
}
/** @param {string} userId @returns {Promise<ReflectionItem[]>} */
export async function getReflectionsForUser(userId) {
  requireUserId(userId); const db = await getDatabase();
  return db.getAllAsync(`SELECT r.*, s.name AS subject_name,
    substr(s.field_colors, 1, instr(s.field_colors || ',', ',') - 1) AS subject_color, t.title AS task_title
    FROM ReflectionItem r JOIN Subject s ON s.id = r.subject_id
    LEFT JOIN StudyBlock b ON b.id = r.study_block_id
    LEFT JOIN Task t ON t.id = b.task_id AND t.user_id = s.user_id
    WHERE s.user_id = ? ORDER BY julianday(r.created_at) DESC, r.id DESC`, userId);
}
