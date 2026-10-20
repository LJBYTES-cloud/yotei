import { getDatabase, requireUserId } from './database';
import { getLocalDateKey, getLocalDayRange } from './dateUtils';

/**
 * Replace one user's local study data with a repeatable demo for today.
 * Authentication and other users' records are never reset.
 * @param {string} userId
 */
export async function seedDemoData(userId) {
  requireUserId(userId);
  const now = new Date();
  const today = getLocalDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrowKey = getLocalDateKey(tomorrow);
  const yesterdayKey = getLocalDateKey(yesterday);
  const { start, end } = getLocalDayRange(today);
  const minute = 60_000;
  // Four hours of study plus three ten-minute breaks, all inside today.
  // Position the window around now so it works even near midnight.
  const anchor = Math.max(Date.parse(start), Math.min(
    Math.floor(now.getTime() / minute) * minute - 90 * minute,
    Date.parse(end) - 270 * minute,
  ));
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync('DELETE FROM Material WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM ReviewItem WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM StudyBlock WHERE task_id IN (SELECT id FROM Task WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM Task WHERE user_id = ?', userId);
    await transaction.runAsync('DELETE FROM Subject WHERE user_id = ?', userId);

    const subjects = [
      { name: 'Mathematics', color: '#C2ACF3' },
      { name: 'Biology', color: '#B0CDBD' },
      { name: 'History', color: '#EAC68D' },
    ];
    /** @type {number[]} */
    const subjectIds = [];
    for (const subject of subjects) {
      const result = await transaction.runAsync(
        'INSERT INTO Subject (user_id, name, color) VALUES (?, ?, ?)', userId, subject.name, subject.color,
      );
      subjectIds.push(result.lastInsertRowId);
    }
    const reviewTopics = [
      'Solving quadratic equations by completing the square',
      'The stages of mitosis and their key differences',
      'Causes of the French Revolution',
    ];
    for (let index = 0; index < reviewTopics.length; index += 1) {
      // New topics are immediately due, matching topics added from a study block.
      await transaction.runAsync(`
        INSERT INTO ReviewItem (subject_id, topic, last_reviewed_at, next_review_at)
        SELECT id, ?, NULL, NULL FROM Subject WHERE id = ? AND user_id = ?
      `, reviewTopics[index], subjectIds[index], userId);
    }
    const tasks = [
      { subject: 0, title: 'Practice quadratic equations for the quiz', deadline: tomorrowKey, minutes: 45, postponed: 0 },
      { subject: 1, title: 'Label the cell cycle diagram', deadline: tomorrowKey, minutes: 40, postponed: 0 },
      { subject: 2, title: 'Build a timeline of the French Revolution', deadline: today, minutes: 50, postponed: 0 },
      { subject: 0, title: 'Finish the algebra problem set', deadline: yesterdayKey, minutes: 60, postponed: 0 },
      { subject: 1, title: 'Explain photosynthesis in five sentences', deadline: today, minutes: 30, postponed: 2 },
      { subject: 2, title: 'Draft the first paragraph of the Industrial Revolution essay', deadline: tomorrowKey, minutes: 25, postponed: 2 },
    ];
    /** @type {number[]} */
    const taskIds = [];
    for (const task of tasks) {
      const result = await transaction.runAsync(`
        INSERT INTO Task (user_id, subject_id, title, deadline, estimated_minutes, status, postpone_count)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `, userId, subjectIds[task.subject], task.title, task.deadline, task.minutes, task.postponed);
      taskIds.push(result.lastInsertRowId);
    }
    const sessionTasks = [taskIds[0], taskIds[1], taskIds[2], taskIds[5]];
    for (let index = 0; index < sessionTasks.length; index += 1) {
      const begins = anchor + index * 70 * minute;
      const ends = begins + 60 * minute;
      // Elapsed sessions stay counted when the dashboard checks for misses.
      const status = ends <= now.getTime() ? 'done' : 'scheduled';
      await transaction.runAsync(`
        INSERT INTO StudyBlock (task_id, start_time, end_time, status)
        SELECT id, ?, ?, ? FROM Task WHERE id = ? AND user_id = ?
      `, new Date(begins).toISOString(), new Date(ends).toISOString(), status, sessionTasks[index], userId);
    }
  });
  return { subjects: 3, tasks: 6, studyBlocks: 4, reviewItems: 3, totalMinutes: 240 };
}
