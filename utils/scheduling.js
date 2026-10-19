/**
 * Interpret HH:mm as today in the device's timezone. Past times are rejected
 * explicitly rather than silently moving the session to tomorrow.
 * @param {{ duration: string, mode: 'now' | 'custom', time: string }} input
 * @param {Date} now
 */
export function buildStudyTimes({ duration, mode, time }, now) {
  const minutes = Number(duration.trim());
  if (!/^\d+$/.test(duration.trim()) || !Number.isSafeInteger(minutes) || minutes < 1) {
    throw new Error('Enter a duration in whole minutes, starting from 1.');
  }
  const start = new Date(now);
  if (mode === 'custom') {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    if (!match) throw new Error('Use a 24-hour time, such as 14:30.');
    start.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (start.getHours() !== Number(match[1]) || start.getMinutes() !== Number(match[2])) {
      throw new Error('This time is unavailable on today’s clock. Choose another time.');
    }
    if (start.getTime() <= now.getTime()) throw new Error('Choose a later time today, or select Now.');
  }
  const end = new Date(start.getTime() + minutes * 60000);
  if (!Number.isFinite(end.getTime())) throw new Error('That duration is too long. Try a smaller number.');
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}
