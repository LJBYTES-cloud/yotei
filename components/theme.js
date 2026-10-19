export const palette = {
  background: '#101018', surface: '#1B1C28', raised: '#232433', line: '#343445',
  text: '#F4F0E9', muted: '#ACABBA', accent: '#C2ACF3', accentSoft: '#30283F',
  warm: '#EAC68D', warmSoft: '#332C25', green: '#B0CDBD', greenSoft: '#24332C',
};

/** @param {number} minutes */
export function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ''}` : `${rounded}m`;
}

/** @param {string} timestamp */
export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
