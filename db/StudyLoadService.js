import { getDatabase, requireUserId } from './database';
import { getLocalDateKey, getLocalDayRange } from './dateUtils';

export const DAILY_STUDY_LIMIT = 240;

/** @typedef {{ date: string, current_minutes: number, added_minutes: number, total_minutes: number }} StudyLoad */

export class StudyLoadWarning extends Error {
  /** @param {StudyLoad[]} days */
  constructor(days) {
    super("You’re planning a heavy day. Remember to take breaks.");
    this.name = 'StudyLoadWarning';
    this.days = days;
  }
}

/**
 * Count planned minutes for scheduled, active and done blocks. Missed history is
 * excluded; cross-midnight sessions contribute only their overlapping minutes.
 * @param {string} userId @param {string} date
 */
export async function getDailyStudyMinutes(userId, date) {
  requireUserId(userId);
  const { start, end } = getLocalDayRange(date);
  const database = await getDatabase();
  const row = /** @type {{ minutes: number } | null} */ (await database.getFirstAsync(`
    SELECT COALESCE(SUM(MAX(0,
      MIN(CAST(ROUND((julianday(block.end_time) - 2440587.5) * 86400000) AS INTEGER), ?)
      - MAX(CAST(ROUND((julianday(block.start_time) - 2440587.5) * 86400000) AS INTEGER), ?)
    )) / 60000.0, 0) AS minutes
    FROM StudyBlock AS block INNER JOIN Task AS task ON task.id = block.task_id
    WHERE task.user_id = ? AND block.status IN ('scheduled', 'active', 'done')
      AND julianday(block.start_time) < julianday(?) AND julianday(block.end_time) > julianday(?)
  `, Date.parse(end), Date.parse(start), userId, end, start));
  return Math.round((row?.minutes ?? 0) * 1e6) / 1e6;
}

/** @param {string} userId @param {string} startTime @param {string} endTime @param {boolean} allowHeavyDay */
export async function checkStudyLoad(userId, startTime, endTime, allowHeavyDay) {
  if (allowHeavyDay === true) return;
  const end = Date.parse(endTime);
  let cursor = Date.parse(startTime);
  /** @type {StudyLoad[]} */
  const warnings = [];
  while (cursor < end) {
    const date = getLocalDateKey(new Date(cursor));
    const range = getLocalDayRange(date);
    const dayEnd = Date.parse(range.end);
    const added = (Math.min(end, dayEnd) - cursor) / 60000;
    const current = await getDailyStudyMinutes(userId, date);
    const total = Math.round((current + added) * 1e6) / 1e6;
    if (total > DAILY_STUDY_LIMIT + 1e-6) warnings.push({ date, current_minutes: current, added_minutes: added, total_minutes: total });
    cursor = dayEnd;
  }
  if (warnings.length) throw new StudyLoadWarning(warnings);
}
