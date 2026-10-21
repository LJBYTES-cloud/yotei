export const DEFAULT_FIELD = 'General';
export const DEFAULT_FIELD_COLORS = '#C2ACF3';

/** @param {unknown} value */
export function normalizeFieldOfStudy(value) {
  if (typeof value !== 'string') throw new Error('Enter a field of study.');
  const field = value.split(',').map(part => part.trim()).filter(Boolean).join(', ');
  if (!field || field.length > 128) throw new Error('Enter a field of study between 1 and 128 characters.');
  return field;
}

/** @param {unknown} value */
export function normalizeFieldColors(value) {
  if (typeof value !== 'string') throw new Error('Choose one or two field colors.');
  const colors = value.split(',').map(color => color.trim().toUpperCase());
  if (colors.length < 1 || colors.length > 2 || colors.some(color => !/^#[0-9A-F]{6}$/.test(color)) || new Set(colors).size !== colors.length) {
    throw new Error('Choose one or two distinct six-digit hex colors.');
  }
  return colors.join(',');
}

/** @param {string} fieldColors */
export function firstFieldColor(fieldColors) {
  return fieldColors.split(',')[0];
}

/** @param {string} fieldColors @returns {[string, string]} */
export function fieldGradient(fieldColors) {
  const [first, second] = normalizeFieldColors(fieldColors).split(',');
  if (second) return [first, second];
  // A single color gets a gentle highlight rather than a flat fill.
  const shade = [1, 3, 5].map(offset => {
    const channel = parseInt(first.slice(offset, offset + 2), 16);
    return Math.round(channel + (255 - channel) * 0.18).toString(16).padStart(2, '0');
  }).join('');
  return [first, `#${shade.toUpperCase()}`];
}
