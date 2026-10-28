/** Convert a website or absolute file location into a link the OS can open.
 * Provider URIs remain opaque references; private copies are handled separately.
 * @param {string} location
 */
export function getMaterialUrl(location) {
  const value = typeof location === 'string' ? location.trim() : '';
  if (!value || /[\r\n\u0000]/.test(value)) throw new Error('Enter a URL or an absolute file path under 4,096 characters.');
  // Android may return long, percent-encoded document IDs. Keep the URI exactly
  // as supplied instead of applying the manual path limit or URL normalization.
  if (/^content:\/\/[^/?#\s]+(?:[/?#]|$)/i.test(value)) return value;
  if (value.length > 4096) throw new Error('Enter a URL or an absolute file path under 4,096 characters.');
  if (/^[a-z]:[\\/]/i.test(value)) return `file:///${encodeURI(value.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
  if (value.startsWith('/')) return `file://${encodeURI(value).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
  if (/^file:\/\//i.test(value)) return value;
  const url = /^www\./i.test(value) ? `https://${value}` : value;
  if (/^https?:\/\//i.test(url)) {
    try { if (new URL(url).hostname) return url; } catch { /* Present the same actionable validation below. */ }
  }
  throw new Error('Use an http(s) URL, file/content URI, or an absolute file path.');
}
