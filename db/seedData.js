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
    await transaction.runAsync('DELETE FROM ReflectionItem WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM StudyBlock WHERE task_id IN (SELECT id FROM Task WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM Task WHERE user_id = ?', userId);
    await transaction.runAsync('DELETE FROM Subject WHERE user_id = ?', userId);

    const subjects = [
      { name: 'Mathematics', subject_code: 'MATH-2', field_of_study: 'Mathematics', field_colors: '#C2ACF3' },
      { name: 'Biology', subject_code: 'BIO-101', field_of_study: 'Biology, Chemistry', field_colors: '#2DD4BF,#60A5FA' },
      { name: 'History', subject_code: 'HIST-101', field_of_study: 'Humanities', field_colors: '#FBBF24,#FB7185' },
    ];
    /** @type {number[]} */
    const subjectIds = [];
    for (const subject of subjects) {
      const result = await transaction.runAsync(
        'INSERT INTO Subject (user_id, name, subject_code, field_of_study, field_colors) VALUES (?, ?, ?, ?, ?)', userId, subject.name, subject.subject_code, subject.field_of_study, subject.field_colors,
      );
      subjectIds.push(result.lastInsertRowId);
    }
    const reflectionNotes = [
      'Completing the square is clearer now. I need more practice checking the final roots.',
      'I can explain the mitosis stages without notes. Next time, draw each stage from memory.',
      'The timeline helped connect the economic and political causes. Revisit the Estates-General.',
    ];
    for (let index = 0; index < reflectionNotes.length; index += 1) {
      // Journal notes are grouped by subject; no spaced-repetition schedule remains.
      await transaction.runAsync(`
        INSERT INTO ReflectionItem (subject_id, note, created_at)
        SELECT id, ?, ? FROM Subject WHERE id = ? AND user_id = ?
      `, reflectionNotes[index], new Date(now.getTime() - (index + 1) * 86400000).toISOString(), subjectIds[index], userId);
    }
    for (let index = 0; index < subjectIds.length; index += 1) {
      await transaction.runAsync('INSERT INTO Material (subject_id, title, url_or_note) VALUES (?, ?, ?)', subjectIds[index],
        ['Mathematics Reference', 'Biology Reference', 'History Reference'][index],
        ['https://openstax.org/subjects/math', 'https://openstax.org/subjects/science', 'https://www.britannica.com/event/French-Revolution'][index]);
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
        INSERT INTO Task (user_id, subject_id, title, description, deadline, estimated_minutes, status, postpone_count)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `, userId, subjectIds[task.subject], task.title, ['Work through the examples and check each result.', 'Label each stage, then explain the process without notes.', 'Use the source timeline and write a short explanation.'][task.subject], task.deadline, task.minutes, task.postponed);
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
    // Six completed local dates showcase the progress chart. Today's planning
    // fixture stays at exactly 240 minutes and keeps its original statuses.
    const historyMinutes = [60, 90, 75, 120, 105, 150];
    for (let index = 0; index < historyMinutes.length; index += 1) {
      const begins = new Date(now);
      begins.setDate(begins.getDate() - (6 - index)); begins.setHours(10, 0, 0, 0);
      const ends = new Date(begins.getTime() + historyMinutes[index] * minute);
      const completed = await transaction.runAsync(`
        INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time, actual_study_seconds)
        SELECT id, ?, ?, 'done', ?, ?, ? FROM Task WHERE id = ? AND user_id = ?
      `, begins.toISOString(), ends.toISOString(), begins.toISOString(), ends.toISOString(), historyMinutes[index] * 60, taskIds[index], userId);
      if (index < 3) await transaction.runAsync('UPDATE ReflectionItem SET study_block_id = ?, created_at = ? WHERE subject_id = ?', completed.lastInsertRowId, ends.toISOString(), subjectIds[index]);
    }
  });
  return { subjects: 3, tasks: 6, studyBlocks: 10, reflectionItems: 3, totalMinutes: 240 };
}
