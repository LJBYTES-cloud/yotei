/** Return a calendar date in the device's local timezone. @param {Date} [date] */
export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * A half-open local calendar day expressed as UTC instants. Advance the calendar
 * date, rather than adding 24 hours, to handle daylight-saving transitions.
 * @param {string} date YYYY-MM-DD in the device's local timezone.
 */
export function getLocalDayRange(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Use a calendar date in YYYY-MM-DD format.');
  }
  const check = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid calendar date.');
  }
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}
