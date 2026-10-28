export const DEFAULT_FIELD = 'General';
export const DEFAULT_FIELD_COLORS = '#C2ACF3';
export const DEFAULT_SUBJECT_CODE = 'GEN-101';

/** @param {unknown} value */
export function normalizeSubjectCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!code || code.length > 32 || !/^[A-Z0-9][A-Z0-9 ._\/-]*$/.test(code)) {
    throw new Error('Enter a subject code of 1–32 letters or numbers, using spaces, hyphens, dots, slashes or underscores if needed.');
  }
  return code;
}

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

/** Theme-only tint; never changes the stored field colors.
 * @param {string} fieldColors @param {string | null} [background] @returns {[string, string]}
 */
export function bookGradient(fieldColors, background = null) {
  const colors = fieldGradient(fieldColors);
  if (!background) return colors;
  const base = [1, 3, 5].map(offset => parseInt(background.slice(offset, offset + 2), 16));
  return /** @type {[string, string]} */ (colors.map(color => {
    const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return '#' + channels.map((channel, index) => Math.round((channel * 0.55 + luminance * 0.45) * 0.42 + base[index] * 0.58).toString(16).padStart(2, '0')).join('').toUpperCase();
  }));
}

/** Existing field labels, normalized and deduplicated case-insensitively.
 * @param {{field_of_study: string}[]} subjects @returns {string[]}
 */
export function getFieldsOfStudy(subjects) {
  const fields = new Map();
  for (const subject of subjects) {
    const name = normalizeFieldOfStudy(subject.field_of_study);
    if (!fields.has(name.toLowerCase())) fields.set(name.toLowerCase(), name);
  }
  return Array.from(fields.values()).sort((a, b) => a.localeCompare(b));
}

/** Stable shelf groups shared by the virtualized Library and shelf renderer.
 * @param {import('../db/SubjectService').Subject[]} subjects
 */
export function groupSubjectsByField(subjects) {
  const fields = new Map(/** @type {[string, {name: string, subjects: import('../db/SubjectService').Subject[]}][]} */ ([]));
  for (const subject of subjects) {
    const key = subject.field_of_study.toLowerCase();
    const group = fields.get(key);
    if (group) group.subjects.push(subject);
    else fields.set(key, { name: subject.field_of_study, subjects: [subject] });
  }
  return Array.from(fields, ([key, value]) => ({ key, ...value }));
}
