/** @param {string | number | Date} value */
function asDate(value) {
  return new Date(typeof value === 'object' ? value.getTime() : value);
}

/** Clock time, not elapsed study/break duration. h23 keeps midnight at 00:00.
 * @param {string | number | Date} value @param {boolean} [is24Hour] @param {string} [locale]
 */
export function formatTime(value, is24Hour = true, locale) {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: is24Hour ? 'h23' : 'h12' }).format(date);
}

/** @param {string | number | Date} value @param {boolean} [is24Hour] @param {string} [locale] */
export function formatDateTime(value, is24Hour = true, locale) {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: is24Hour ? 'h23' : 'h12' }).format(date);
}
