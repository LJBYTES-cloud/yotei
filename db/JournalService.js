import { getDatabase, requireUserId } from './database';

/** @typedef {{id: number, user_id: string, title: string, content: string, created_at: string}} JournalEntry */
/** @typedef {{id: string, source_id: number, kind: 'entry' | 'reflection', title: string, content: string, created_at: string, subject_name: string | null}} JournalFeedItem */

/** @param {string} userId @param {{title: string, content: string}} input @returns {Promise<JournalEntry>} */
export async function createJournalEntry(userId, { title, content }) {
  requireUserId(userId);
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) throw new Error('Enter a title between 1 and 200 characters.');
  if (typeof content !== 'string' || !content.trim() || content.length > 12000) throw new Error('Enter content between 1 and 12,000 characters.');
  const db = await getDatabase(), created_at = new Date().toISOString();
  const result = await db.runAsync('INSERT INTO JournalEntry (user_id, title, content, created_at) VALUES (?, ?, ?, ?)', userId, title.trim(), content.trim(), created_at);
  return { id: result.lastInsertRowId, user_id: userId, title: title.trim(), content: content.trim(), created_at };
}

/** @param {string} userId @returns {Promise<JournalEntry[]>} */
export async function getJournalEntriesForUser(userId) {
  requireUserId(userId); const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM JournalEntry WHERE user_id = ? ORDER BY julianday(created_at) DESC, id DESC', userId);
}

/** @param {number} id @param {'entry' | 'reflection'} kind */
function requireEntry(id, kind) {
  if (!Number.isSafeInteger(id) || id < 1 || !['entry', 'reflection'].includes(kind)) throw new Error('Choose a valid journal entry.');
}

/** Edit either feed source without changing its date, subject or session link.
 * Reflection titles come from their task; only their note is editable.
 * @param {string} userId @param {number} entryId
 * @param {{title?: string, content: string}} input @param {'entry' | 'reflection'} [kind]
 */
export async function updateJournalEntry(userId, entryId, { title, content }, kind = 'entry') {
  requireUserId(userId); requireEntry(entryId, kind);
  const limit = kind === 'reflection' ? 4000 : 12000;
  if (typeof content !== 'string' || !content.trim() || content.length > limit) throw new Error(`Enter content between 1 and ${limit.toLocaleString('en-US')} characters.`);
  if (kind === 'entry' && (typeof title !== 'string' || !title.trim() || title.trim().length > 200)) throw new Error('Enter a title between 1 and 200 characters.');
  const db = await getDatabase();
  const result = kind === 'entry'
    ? await db.runAsync('UPDATE JournalEntry SET title = ?, content = ? WHERE id = ? AND user_id = ?', title?.trim() ?? '', content.trim(), entryId, userId)
    : await db.runAsync('UPDATE ReflectionItem SET note = ? WHERE id = ? AND subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', content.trim(), entryId, userId);
  if (result.changes !== 1) throw new Error('This journal entry is no longer available in your account.');
}

/** Delete only the note, never its task, subject or completed session.
 * @param {string} userId @param {number} entryId @param {'entry' | 'reflection'} [kind]
 */
export async function deleteJournalEntry(userId, entryId, kind = 'entry') {
  requireUserId(userId); requireEntry(entryId, kind);
  const db = await getDatabase();
  const result = kind === 'entry'
    ? await db.runAsync('DELETE FROM JournalEntry WHERE id = ? AND user_id = ?', entryId, userId)
    : await db.runAsync('DELETE FROM ReflectionItem WHERE id = ? AND subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', entryId, userId);
  if (result.changes !== 1) throw new Error('This journal entry is no longer available in your account.');
}

/** Manual entries and focus-session reflections share one chronological feed.
 * Namespaced IDs prevent collisions between the two independent tables.
 * @param {string} userId @returns {Promise<JournalFeedItem[]>}
 */
export async function getJournalFeedForUser(userId) {
  requireUserId(userId); const db = await getDatabase();
  return db.getAllAsync(`SELECT * FROM (SELECT 'entry-' || id AS id, id AS source_id, 'entry' AS kind,
      title, content, created_at, NULL AS subject_name FROM JournalEntry WHERE user_id = ?
    UNION ALL
    SELECT 'reflection-' || r.id, r.id, 'reflection', COALESCE(t.title, 'Study Reflection'), r.note, r.created_at, s.name
      FROM ReflectionItem r JOIN Subject s ON s.id = r.subject_id
      LEFT JOIN StudyBlock b ON b.id = r.study_block_id LEFT JOIN Task t ON t.id = b.task_id AND t.user_id = s.user_id
      WHERE s.user_id = ?)
    ORDER BY julianday(created_at) DESC, kind, source_id DESC`, userId, userId);
}
