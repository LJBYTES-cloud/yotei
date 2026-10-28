import { getDatabase, requireUserId } from './database';
import { getLocalDateKey, getLocalDayRange } from './dateUtils';

/** @typedef {{date: string, minutes: number}} StudyProgressDay */

/** Completed study minutes for seven local calendar days, including endDate.
 * Timer sessions use saved actual seconds (breaks already excluded); legacy
 * untimed completions use scheduled duration. Credit goes to the completion day.
 * @param {string} userId @param {string} [endDate] @returns {Promise<StudyProgressDay[]>}
 */
export async function getWeeklyStudyMinutes(userId, endDate = getLocalDateKey()) {
  requireUserId(userId);
  getLocalDayRange(endDate); // Validate before opening storage.
  const anchor = new Date(`${endDate}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchor); day.setDate(day.getDate() - (6 - index));
    const date = getLocalDateKey(day);
    return { date, ...getLocalDayRange(date) };
  });
  const database = await getDatabase();
  const rows = /** @type {StudyProgressDay[]} */ (await database.getAllAsync(`
    WITH days(date, start_time, end_time) AS (VALUES ${days.map(() => '(?, ?, ?)').join(', ')})
    SELECT days.date, COALESCE(SUM(
      CASE WHEN completed.actual_start_time IS NOT NULL OR completed.actual_end_time IS NOT NULL
        THEN MAX(0, completed.actual_study_seconds) / 60.0
        ELSE MAX(0, ROUND((julianday(completed.end_time) - julianday(completed.start_time)) * 86400000)) / 60000.0
      END
    ), 0) AS minutes
    FROM days
    LEFT JOIN (
      SELECT block.* FROM StudyBlock AS block
      INNER JOIN Task AS task ON task.id = block.task_id
      WHERE task.user_id = ? AND block.status = 'done'
        AND julianday(COALESCE(block.actual_end_time, block.end_time)) >= julianday(?)
        AND julianday(COALESCE(block.actual_end_time, block.end_time)) < julianday(?)
    ) AS completed
      ON julianday(COALESCE(completed.actual_end_time, completed.end_time)) >= julianday(days.start_time)
      AND julianday(COALESCE(completed.actual_end_time, completed.end_time)) < julianday(days.end_time)
    GROUP BY days.date ORDER BY days.date ASC
  `, ...days.flatMap(day => [day.date, day.start, day.end]), userId, days[0].start, days[6].end));
  return rows.map(row => ({ date: row.date, minutes: Math.round(row.minutes * 1e6) / 1e6 }));
}

/** @typedef {{id: number, task_title: string, subject_name: string, start_time: string, end_time: string, actual_start_time: string | null, actual_end_time: string | null, studied_minutes: number, planned_minutes: number, break_minutes: number, elapsed_minutes: number, overrun_minutes: number, finished_late_minutes: number}} StudyDaySession */
/** Completed sessions credited to the same completion-day boundaries as the chart.
 * @param {string} userId @param {string} date @returns {Promise<StudyDaySession[]>}
 */
export async function getStudyDayDetails(userId, date) {
  requireUserId(userId); const range = getLocalDayRange(date), db = await getDatabase();
  const rows = /** @type {(StudyDaySession & {actual_study_seconds: number, break_time_ms: number})[]} */ (await db.getAllAsync(`
    SELECT b.*, t.title AS task_title, s.name AS subject_name FROM StudyBlock b
    JOIN Task t ON t.id = b.task_id JOIN Subject s ON s.id = t.subject_id AND s.user_id = t.user_id
    WHERE t.user_id = ? AND b.status = 'done'
      AND julianday(COALESCE(b.actual_end_time, b.end_time)) >= julianday(?)
      AND julianday(COALESCE(b.actual_end_time, b.end_time)) < julianday(?)
    ORDER BY julianday(COALESCE(b.actual_end_time, b.end_time)), b.id
  `, userId, range.start, range.end));
  return rows.map(row => {
    const planned = (Date.parse(row.end_time) - Date.parse(row.start_time)) / 60000;
    const timed = row.actual_start_time !== null;
    const manual = !timed && row.actual_end_time !== null;
    const elapsed = timed ? (Date.parse(/** @type {string} */ (row.actual_end_time)) - Date.parse(/** @type {string} */ (row.actual_start_time))) / 60000 : manual ? row.actual_study_seconds / 60 : planned;
    return { id: row.id, task_title: row.task_title, subject_name: row.subject_name,
      start_time: row.start_time, end_time: row.end_time, actual_start_time: row.actual_start_time, actual_end_time: row.actual_end_time,
      studied_minutes: timed || manual ? row.actual_study_seconds / 60 : planned, planned_minutes: planned,
      break_minutes: timed ? row.break_time_ms / 60000 : 0,
      elapsed_minutes: elapsed, overrun_minutes: Math.max(0, elapsed - planned),
      finished_late_minutes: timed ? Math.max(0, (Date.parse(/** @type {string} */ (row.actual_end_time)) - Date.parse(row.end_time)) / 60000) : 0,
    };
  });
}
