import { getDatabase, requireUserId } from './database';
import { getLocalDayRange } from './dateUtils';

/**
 * @typedef {{ id: number, task_id: number, start_time: string, end_time: string,
 * status: string, task_title: string, subject_name: string, subject_color: string }} StudyBlock
 */

/**
 * @param {string} userId
 * @param {{ task_id: number, start_time: string, end_time: string }} input
 * @returns {Promise<StudyBlock>}
 */
export async function createStudyBlock(userId, { task_id, start_time, end_time }) {
  requireUserId(userId);
  if (!Number.isSafeInteger(task_id) || task_id < 1) {
    throw new Error('Choose a task to schedule.');
  }
  const start = typeof start_time === 'string' ? Date.parse(start_time) : NaN;
  const end = typeof end_time === 'string' ? Date.parse(end_time) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Choose valid study times with the end after the start.');
  }
  const database = await getDatabase();
  const task = /** @type {{ title: string, subject_name: string, subject_color: string } | null} */ (
    await database.getFirstAsync(`
      SELECT task.title, subject.name AS subject_name, subject.color AS subject_color
      FROM Task AS task
      INNER JOIN Subject AS subject ON subject.id = task.subject_id AND subject.user_id = task.user_id
      WHERE task.id = ? AND task.user_id = ?
    `, task_id, userId)
  );
  if (!task) throw new Error('Choose a task belonging to your account.');
  const startTime = new Date(start).toISOString();
  const endTime = new Date(end).toISOString();
  // Ownership is checked again atomically at insertion, not just in the lookup.
  const result = await database.runAsync(`
    INSERT INTO StudyBlock (task_id, start_time, end_time, status)
    SELECT id, ?, ?, ? FROM Task WHERE id = ? AND user_id = ?
  `, startTime, endTime, 'planned', task_id, userId);
  if (result.changes !== 1) throw new Error('This task is no longer available to schedule.');
  return {
    id: result.lastInsertRowId, task_id, start_time: startTime, end_time: endTime,
    status: 'planned', task_title: task.title,
    subject_name: task.subject_name, subject_color: task.subject_color,
  };
}

/**
 * Optionally fetch only blocks overlapping a local calendar date.
 * @param {string} userId
 * @param {{ date?: string }} [options]
 * @returns {Promise<StudyBlock[]>}
 */
export async function getStudyBlocksForUser(userId, { date } = {}) {
  requireUserId(userId);
  const range = date === undefined ? null : getLocalDayRange(date);
  const database = await getDatabase();
  return database.getAllAsync(`
    SELECT block.*, task.title AS task_title,
      subject.name AS subject_name, subject.color AS subject_color
    FROM StudyBlock AS block
    INNER JOIN Task AS task ON task.id = block.task_id
    INNER JOIN Subject AS subject ON subject.id = task.subject_id AND subject.user_id = task.user_id
    WHERE task.user_id = ?
      ${range ? 'AND julianday(block.start_time) < julianday(?) AND julianday(block.end_time) > julianday(?)' : ''}
    ORDER BY julianday(block.start_time) ASC, block.id ASC
  `, ...(range ? [userId, range.end, range.start] : [userId]));
}
