import { getDatabase, requireUserId } from './database';

/**
 * @typedef {{ id: number, user_id: string, subject_id: number, title: string,
 * deadline: string | null, estimated_minutes: number, status: string,
 * postpone_count: number, subject_name: string, subject_color: string }} Task
 */

/**
 * @param {string} userId
 * @param {{ title: string, subject_id: number, deadline?: string | null, estimated_minutes?: number }} input
 * @returns {Promise<Task>}
 */
export async function createTask(userId, { title, subject_id, deadline = null, estimated_minutes = 30 }) {
  requireUserId(userId);
  const trimmedTitle = title.trim();
  if (!trimmedTitle || trimmedTitle.length > 256) {
    throw new Error('Enter a task title between 1 and 256 characters.');
  }
  if (!Number.isSafeInteger(subject_id) || subject_id < 1) {
    throw new Error('Choose a subject for this task.');
  }
  if (!Number.isSafeInteger(estimated_minutes) || estimated_minutes < 1) {
    throw new Error('Estimated minutes must be a positive whole number.');
  }
  if (deadline !== null && (typeof deadline !== 'string' || !Number.isFinite(Date.parse(deadline)))) {
    throw new Error('Enter a valid deadline.');
  }
  const database = await getDatabase();
  const subject = /** @type {import('./SubjectService').Subject | null} */ (
    await database.getFirstAsync('SELECT id, user_id, name, color FROM Subject WHERE id = ? AND user_id = ?', subject_id, userId)
  );
  if (!subject) {
    throw new Error('Choose a subject belonging to your account.');
  }
  // The composite foreign key also enforces ownership if data changes between
  // the lookup and this insert. Every value is bound, never interpolated.
  const result = await database.runAsync(
    'INSERT INTO Task (user_id, subject_id, title, deadline, estimated_minutes, status, postpone_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId, subject_id, trimmedTitle, deadline, estimated_minutes, 'pending', 0,
  );
  return {
    id: result.lastInsertRowId, user_id: userId, subject_id, title: trimmedTitle,
    deadline, estimated_minutes, status: 'pending', postpone_count: 0,
    subject_name: subject.name, subject_color: subject.color,
  };
}

/** @param {string} userId @returns {Promise<Task[]>} */
export async function getTasksForUser(userId) {
  requireUserId(userId);
  const database = await getDatabase();
  return database.getAllAsync(`
    SELECT task.*, subject.name AS subject_name, subject.color AS subject_color
    FROM Task AS task
    INNER JOIN Subject AS subject ON subject.id = task.subject_id AND subject.user_id = task.user_id
    WHERE task.user_id = ?
    ORDER BY task.id DESC
  `, userId);
}
