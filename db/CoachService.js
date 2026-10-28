import { getDatabase, requireUserId } from './database';
import { getLocalDateKey, getLocalDayRange } from './dateUtils';

/** @typedef {{completedToday: boolean, completedYesterday: boolean, bestHour: number | null}} CoachHistory */

/** Local-calendar streaks count completions, including zero-minute/manual ones.
 * Best-time suggestions require three completions in that hour; actual work is
 * the metric, with scheduled duration for legacy untimed sessions.
 * @param {string} userId @param {string} [today] @param {string} [now]
 * @returns {Promise<CoachHistory>}
 */
export async function getCoachHistory(userId, today = getLocalDateKey(), now = new Date().toISOString()) {
  requireUserId(userId);
  const range = getLocalDayRange(today);
  if (!Number.isFinite(Date.parse(now))) throw new Error('Choose a valid reference time.');
  const yesterday = new Date(`${today}T12:00:00`); yesterday.setDate(yesterday.getDate() - 1);
  const previous = getLocalDayRange(getLocalDateKey(yesterday));
  const db = await getDatabase();
  const rows = /** @type {{instant: string, seconds: number, count: number, today: number, yesterday: number}[]} */ (await db.getAllAsync(`
    WITH completions AS (SELECT COALESCE(b.actual_end_time, b.end_time) AS completed_at,
      strftime('%Y-%m-%dT%H:%M:00Z', COALESCE(b.actual_start_time, b.actual_end_time, b.start_time)) AS instant,
      CASE WHEN b.actual_start_time IS NOT NULL OR b.actual_end_time IS NOT NULL THEN b.actual_study_seconds
        ELSE MAX(0, ROUND((julianday(b.end_time) - julianday(b.start_time)) * 86400)) END AS seconds
    FROM StudyBlock b JOIN Task t ON t.id = b.task_id
    WHERE t.user_id = ? AND b.status = 'done'
      AND julianday(COALESCE(b.actual_end_time, b.end_time)) <= julianday(?))
    SELECT instant, SUM(seconds) AS seconds, SUM(CASE WHEN seconds > 0 THEN 1 ELSE 0 END) AS count,
      MAX(CASE WHEN julianday(completed_at) >= julianday(?) AND julianday(completed_at) < julianday(?) THEN 1 ELSE 0 END) AS today,
      MAX(CASE WHEN julianday(completed_at) >= julianday(?) AND julianday(completed_at) < julianday(?) THEN 1 ELSE 0 END) AS yesterday
    FROM completions GROUP BY instant
  `, userId, new Date(now).toISOString(), range.start, range.end, previous.start, previous.end));
  // Convert each historical instant in JS, matching dateUtils and the UI even
  // through DST, fractional-hour offsets, and differing SQLite host TZ support.
  const hours = new Map(/** @type {[number, {hour: number, count: number, seconds: number}][]} */ ([]));
  for (const row of rows) {
    const hour = new Date(row.instant).getHours();
    if (!Number.isInteger(hour) || row.seconds <= 0) continue;
    const total = hours.get(hour) ?? { hour, count: 0, seconds: 0 };
    total.count += row.count; total.seconds += row.seconds; hours.set(hour, total);
  }
  const best = [...hours.values()].filter(row => row.count >= 3).sort((a, b) => b.seconds - a.seconds || a.hour - b.hour)[0];
  return { completedToday: rows.some(row => row.today === 1), completedYesterday: rows.some(row => row.yesterday === 1), bestHour: best?.hour ?? null };
}
