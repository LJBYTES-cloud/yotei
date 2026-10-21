/** @typedef {{ startTime: string, endTime: string, startDay: 'today' | 'tomorrow', endDay: 'today' | 'tomorrow' }} StudyWindow */

/** @param {Date} date */
function clockTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Keep the existing coaching/reschedule duration as an editable initial window.
 * Start at the next full minute so opening the sheet never selects a past time.
 * If a clock repeats, choose a representable future window with the same length.
 * @param {Date} now
 * @param {number} [initialDuration]
 * @returns {StudyWindow}
 */
export function getInitialStudyWindow(now, initialDuration = 30) {
  if (!Number.isFinite(now.getTime())) throw new Error('The current date is unavailable. Please try again.');
  const start = new Date(Math.floor(now.getTime() / 60000) * 60000 + 60000);
  // The time-only UI offers today/tomorrow. An old multi-day duration remains
  // editable without silently presenting its end on the wrong calendar date.
  const latestEnd = new Date(now);
  latestEnd.setDate(latestEnd.getDate() + 1);
  latestEnd.setHours(23, 59, 0, 0);
  const minutes = Number.isFinite(initialDuration) && initialDuration > 0 ? Math.round(initialDuration) : 30;
  let end;
  while (true) {
    const available = (latestEnd.getTime() - start.getTime()) / 60000;
    end = new Date(start.getTime() + Math.min(available, Math.max(1, minutes)) * 60000);
    const parsedStart = localClock(clockTime(start), start, 'start time').getTime();
    const parsedEnd = localClock(clockTime(end), end, 'end time').getTime();
    if (parsedStart === start.getTime() && parsedEnd === end.getTime() && parsedStart > now.getTime()) break;
    // A repeated HH:mm resolves to its first occurrence. Move only this initial
    // suggestion to the next representable window; never alter manual inputs.
    start.setTime(start.getTime() + 60000);
  }
  return {
    startTime: clockTime(start),
    endTime: clockTime(end),
    startDay: start.getDate() === now.getDate() ? 'today' : 'tomorrow',
    endDay: end.getDate() === now.getDate() ? 'today' : 'tomorrow',
  };
}

/** @param {string} value @param {Date} day @param {string} field */
function localClock(value, day, field) {
  const match = typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Enter a valid ${field} using HH:mm, such as 18:00.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  if (result.getFullYear() !== day.getFullYear() || result.getMonth() !== day.getMonth()
    || result.getDate() !== day.getDate() || result.getHours() !== hours || result.getMinutes() !== minutes) {
    throw new Error(`That ${field} is unavailable on this date. Choose another time.`);
  }
  return result;
}

/**
 * Interpret local HH:mm clocks without silently moving a past start or a
 * reversed end to another date. Overnight sessions require explicit tomorrow.
 * Store actual instants so workload checks include daylight-saving changes.
 * @param {StudyWindow} input
 * @param {Date} now
 */
export function buildStudyTimes({ startTime, endTime, startDay, endDay }, now) {
  if (!Number.isFinite(now.getTime())) throw new Error('The current date is unavailable. Please try again.');
  if (startDay !== 'today' && startDay !== 'tomorrow') throw new Error('Choose whether the session starts today or tomorrow.');
  if (endDay !== 'today' && endDay !== 'tomorrow') throw new Error('Choose whether the session ends today or tomorrow.');
  const startDate = new Date(now);
  if (startDay === 'tomorrow') startDate.setDate(startDate.getDate() + 1);
  const start = localClock(startTime, startDate, 'start time');
  if (start.getTime() <= now.getTime()) throw new Error('Choose a future start time.');
  const endDate = new Date(now);
  if (endDay === 'tomorrow') endDate.setDate(endDate.getDate() + 1);
  const end = localClock(endTime, endDate, 'end time');
  if (end.getTime() <= start.getTime()) {
    throw new Error('Choose an end time after the start. Check both times and days.');
  }
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}
