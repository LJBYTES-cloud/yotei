/** @param {number} minutes */
export function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ''}` : `${rounded}m`;
}

export { formatTime } from '../utils/timeFormat';
