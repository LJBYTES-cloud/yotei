/** @typedef {{ start: Date, end: Date }} StudyWindow */

/** Support real finite dates, including native-picker and isolated test realms. @param {unknown} value */
function validDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && Number.isFinite(/** @type {Date} */ (value).getTime());
}

/** Suggestions retain coaching/original duration without limiting the calendar.
 * @param {Date} now @param {number} [initialDuration] @returns {StudyWindow}
 */
export function getInitialStudyWindow(now, initialDuration = 30) {
  if (!validDate(now)) throw new Error('The current date is unavailable. Please try again.');
  const minutes = Number.isFinite(initialDuration) && initialDuration > 0 ? Math.round(initialDuration) : 30;
  const start = new Date(Math.floor(now.getTime() / 60000) * 60000 + 60000);
  const end = new Date(start.getTime() + Math.max(1, minutes) * 60000);
  if (!validDate(start) || !validDate(end)) throw new Error('The session duration is too long. Choose a shorter session.');
  return { start, end };
}

/**
 * Change only the picked calendar or clock component, preserving local time.
 * Moving the start keeps the selected duration; changing the end is independent.
 * @param {StudyWindow} window @param {'start' | 'end'} field
 * @param {'date' | 'time'} part @param {Date} selected @returns {StudyWindow}
 */
export function updateStudyWindow(window, field, part, selected) {
  if (!validDate(window.start) || !validDate(window.end) || !validDate(selected)) throw new Error('Choose a valid date and time.');
  if (!['start', 'end'].includes(field) || !['date', 'time'].includes(part)) throw new Error('Choose a valid date or time field.');
  const previous = window[field];
  const sameDay = previous.getFullYear() === selected.getFullYear() && previous.getMonth() === selected.getMonth() && previous.getDate() === selected.getDate();
  let next;
  if (part === 'date' && sameDay) {
    next = new Date(previous);
  } else if (part === 'time' && sameDay) {
    // Keep the native picker's instant, including a repeated DST hour.
    next = new Date(selected.getTime() - selected.getSeconds() * 1000 - selected.getMilliseconds());
  } else {
    const date = part === 'date' ? selected : previous;
    const clock = part === 'time' ? selected : previous;
    next = new Date(previous);
    next.setHours(12, 0, 0, 0);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    next.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
    if (next.getFullYear() !== date.getFullYear() || next.getMonth() !== date.getMonth() || next.getDate() !== date.getDate()
      || next.getHours() !== clock.getHours() || next.getMinutes() !== clock.getMinutes()) {
      throw new Error('That local time is unavailable on this date. Choose another time.');
    }
  }
  const duration = window.end.getTime() - window.start.getTime();
  const end = field === 'start' ? new Date(next.getTime() + Math.max(60000, duration)) : next;
  if (!validDate(next) || !validDate(end)) throw new Error('Choose a valid session end date.');
  return field === 'start' ? { start: next, end } : { start: window.start, end };
}

/** Validate full selected instants, with no today/tomorrow restriction.
 * @param {StudyWindow} window @param {Date} now
 */
export function buildStudyTimes({ start, end }, now) {
  if (!validDate(now)) throw new Error('The current date is unavailable. Please try again.');
  if (!validDate(start) || !validDate(end)) throw new Error('Choose a valid start and end date/time.');
  if (start.getTime() < now.getTime()) throw new Error('The selected start has already passed. Choose a later date or time.');
  if (end.getTime() <= start.getTime()) throw new Error('Choose an end date/time after the start.');
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}
