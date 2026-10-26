/** @typedef {{actual_start_time: string | null, actual_end_time: string | null, break_started_at: string | null, break_time_ms: number, actual_study_seconds: number, start_time: string}} TimerData */

/** Derive elapsed time from persisted instants, never from the number of ticks.
 * @param {TimerData} block @param {number} [now]
 */
export function getFocusTiming(block, now = Date.now()) {
  const started = block.actual_start_time === null ? null : Date.parse(block.actual_start_time);
  const end = block.actual_end_time === null ? now : Date.parse(block.actual_end_time);
  const openBreak = block.break_started_at === null ? 0 : Math.max(0, end - Date.parse(block.break_started_at));
  const breakMs = block.break_time_ms + openBreak;
  return {
    workSeconds: block.actual_end_time !== null ? block.actual_study_seconds : started === null ? 0 : Math.max(0, Math.floor((end - started - breakMs) / 1000)),
    breakSeconds: Math.floor(breakMs / 1000),
    currentBreakSeconds: Math.floor(openBreak / 1000),
    startedLate: started !== null && started > Date.parse(block.start_time),
    lateMinutes: started === null ? 0 : Math.max(0, Math.floor((started - Date.parse(block.start_time)) / 60000)),
  };
}

/** @param {number} seconds */
export function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const remainder = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}
