/** Clean whole-hour ticks, with at most six intervals even for very long days.
 * @param {number[]} minutes
 */
export function getProgressAxis(minutes) {
  const highest = Math.max(0, ...minutes.filter(value => Number.isFinite(value) && value >= 0));
  const step = 60 * Math.max(1, Math.ceil(highest / 360));
  const maximum = Math.max(step, Math.ceil(highest / step) * step);
  return { maximum, segments: maximum / step, step };
}

/** Chart Kit passes numeric labels as strings. @param {string} label */
export function formatProgressAxisLabel(label) {
  const minutes = Math.max(0, Math.round(Number(label)));
  if (!Number.isFinite(minutes) || minutes === 0) return '0';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
}
