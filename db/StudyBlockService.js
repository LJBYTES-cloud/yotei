import { getDatabase, requireUserId } from './database';
import { getLocalDayRange } from './dateUtils';
import { checkStudyLoad } from './StudyLoadService';

// Serialize scheduling writes so simultaneous submissions see each other's
// SQLite totals before applying the daily guardrail.
let scheduleQueue = Promise.resolve();
/** @param {() => Promise<StudyBlock>} action */
function scheduleMutation(action) {
  const result = scheduleQueue.then(action);
  scheduleQueue = result.then(() => {}, () => {});
  return result;
}

/**
 * @typedef {{ id: number, task_id: number, start_time: string, end_time: string,
 * status: 'scheduled' | 'done' | 'missed', rescheduled_from: number | null,
 * rescheduled_to: number | null, task_title: string, subject_id: number, subject_name: string, subject_color: string }} StudyBlock
 */

const BLOCK_SELECT = `
  SELECT block.*, task.title AS task_title, task.subject_id,
    subject.name AS subject_name,
    substr(subject.field_colors, 1, instr(subject.field_colors || ',', ',') - 1) AS subject_color,
    replacement.id AS rescheduled_to
  FROM StudyBlock AS block
  INNER JOIN Task AS task ON task.id = block.task_id
  INNER JOIN Subject AS subject ON subject.id = task.subject_id AND subject.user_id = task.user_id
  LEFT JOIN StudyBlock AS replacement ON replacement.rescheduled_from = block.id
`;

/** @param {number} id */
function requireBlockId(id) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose a valid study block.');
}

/** @param {string} now */
function parseNow(now) {
  const time = typeof now === 'string' ? Date.parse(now) : NaN;
  if (!Number.isFinite(time)) throw new Error('Choose a valid reference time.');
  return time;
}

/** @param {string} userId @param {number} id @returns {Promise<StudyBlock>} */
async function getBlock(userId, id) {
  const database = await getDatabase();
  const block = /** @type {StudyBlock | null} */ (await database.getFirstAsync(
    `${BLOCK_SELECT} WHERE block.id = ? AND task.user_id = ?`, id, userId,
  ));
  if (!block) throw new Error('Choose a study block belonging to your account.');
  return block;
}

/**
 * @param {string} userId
 * @param {{ task_id: number, start_time: string, end_time: string }} input
 * @param {{ allowHeavyDay?: boolean }} [options]
 * @returns {Promise<StudyBlock>}
 */
export function createStudyBlock(userId, input, { allowHeavyDay = false } = {}) {
  return scheduleMutation(() => createBlock(userId, input, allowHeavyDay));
}

/** @param {string} userId @param {{ task_id: number, start_time: string, end_time: string }} input @param {boolean} allowHeavyDay @returns {Promise<StudyBlock>} */
async function createBlock(userId, { task_id, start_time, end_time }, allowHeavyDay) {
  requireUserId(userId);
  if (!Number.isSafeInteger(task_id) || task_id < 1) {
    throw new Error('Choose a task to schedule.');
  }
  const start = typeof start_time === 'string' ? Date.parse(start_time) : NaN;
  const end = typeof end_time === 'string' ? Date.parse(end_time) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Choose valid study times with the end after the start.');
  }
  const database = await getDatabase();
  const task = /** @type {{ title: string, subject_id: number, subject_name: string, subject_color: string } | null} */ (
    await database.getFirstAsync(`
      SELECT task.title, task.subject_id, subject.name AS subject_name,
        substr(subject.field_colors, 1, instr(subject.field_colors || ',', ',') - 1) AS subject_color
      FROM Task AS task
      INNER JOIN Subject AS subject ON subject.id = task.subject_id AND subject.user_id = task.user_id
      WHERE task.id = ? AND task.user_id = ?
    `, task_id, userId)
  );
  if (!task) throw new Error('Choose a task belonging to your account.');
  const startTime = new Date(start).toISOString();
  const endTime = new Date(end).toISOString();
  await checkStudyLoad(userId, startTime, endTime, allowHeavyDay);
  // Ownership is checked again atomically at insertion, not just in the lookup.
  const result = await database.runAsync(`
    INSERT INTO StudyBlock (task_id, start_time, end_time, status)
    SELECT id, ?, ?, ? FROM Task WHERE id = ? AND user_id = ?
  `, startTime, endTime, 'scheduled', task_id, userId);
  if (result.changes !== 1) throw new Error('This task is no longer available to schedule.');
  return {
    id: result.lastInsertRowId, task_id, start_time: startTime, end_time: endTime,
    status: 'scheduled', rescheduled_from: null, rescheduled_to: null, task_title: task.title,
    subject_id: task.subject_id, subject_name: task.subject_name, subject_color: task.subject_color,
  };
}

/**
 * Optionally fetch only blocks overlapping a local calendar date.
 * @param {string} userId
 * @param {{ date?: string, includeUnresolvedMissed?: boolean }} [options]
 * @returns {Promise<StudyBlock[]>}
 */
export async function getStudyBlocksForUser(userId, { date, includeUnresolvedMissed = false } = {}) {
  requireUserId(userId);
  const range = date === undefined ? null : getLocalDayRange(date);
  const database = await getDatabase();
  return database.getAllAsync(`
    ${BLOCK_SELECT}
    WHERE task.user_id = ?
      ${range ? `AND ((julianday(block.start_time) < julianday(?) AND julianday(block.end_time) > julianday(?))
        ${includeUnresolvedMissed ? "OR (block.status = 'missed' AND replacement.id IS NULL)" : ''})` : ''}
    ORDER BY julianday(block.start_time) ASC, block.id ASC
  `, ...(range ? [userId, range.end, range.start] : [userId]));
}

/** Fetch expired sessions still awaiting a status update. @param {string} userId @param {string} [now] @returns {Promise<StudyBlock[]>} */
export async function getMissedBlocksForUser(userId, now = new Date().toISOString()) {
  requireUserId(userId);
  const reference = new Date(parseNow(now)).toISOString();
  const database = await getDatabase();
  return database.getAllAsync(`${BLOCK_SELECT}
    WHERE task.user_id = ? AND block.status = 'scheduled' AND julianday(block.end_time) < julianday(?)
    ORDER BY julianday(block.end_time) ASC, block.id ASC
  `, userId, reference);
}

/** Mark expired scheduled sessions without overwriting completed sessions. @param {string} userId @param {string} [now] */
export async function markExpiredStudyBlocks(userId, now = new Date().toISOString()) {
  requireUserId(userId);
  const reference = new Date(parseNow(now)).toISOString();
  const database = await getDatabase();
  return database.runAsync(`
    UPDATE StudyBlock SET status = 'missed'
    WHERE status = 'scheduled' AND julianday(end_time) < julianday(?)
      AND task_id IN (SELECT id FROM Task WHERE user_id = ?)
  `, reference, userId);
}

/** @param {string} userId @param {number} blockId @param {'done' | 'missed'} status @returns {Promise<StudyBlock>} */
export async function updateStudyBlockStatus(userId, blockId, status) {
  requireUserId(userId);
  requireBlockId(blockId);
  if (status !== 'done' && status !== 'missed') throw new Error('Use done or missed as the study block status.');
  const database = await getDatabase();
  await database.runAsync(`
    UPDATE StudyBlock SET status = ? WHERE id = ? AND status = 'scheduled'
      AND task_id IN (SELECT id FROM Task WHERE user_id = ?)
  `, status, blockId, userId);
  const block = await getBlock(userId, blockId);
  if (block.status !== status) throw new Error('This study block has already been resolved.');
  return block;
}

/**
 * Preserve the missed session, and link one replacement starting an hour ahead.
 * The unique link and guarded INSERT make retries/rapid taps idempotent.
 * @param {string} userId @param {number} blockId @param {string} [now]
 * @param {{ start_time?: string, end_time?: string, allowHeavyDay?: boolean }} [options]
 * @returns {Promise<StudyBlock>}
 */
export function rescheduleStudyBlock(userId, blockId, now = new Date().toISOString(), options = {}) {
  return scheduleMutation(() => rescheduleBlock(userId, blockId, now, options));
}

/** @param {string} userId @param {number} blockId @param {string} now @param {{ start_time?: string, end_time?: string, allowHeavyDay?: boolean }} options @returns {Promise<StudyBlock>} */
async function rescheduleBlock(userId, blockId, now, { start_time, end_time, allowHeavyDay = false }) {
  requireUserId(userId);
  requireBlockId(blockId);
  const reference = parseNow(now);
  const original = await getBlock(userId, blockId);
  if (original.status !== 'missed') throw new Error('Only missed study blocks can be rescheduled.');
  if (original.rescheduled_to) return getBlock(userId, original.rescheduled_to);
  const duration = Date.parse(original.end_time) - Date.parse(original.start_time);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('This study block has invalid times.');
  const startTime = new Date(start_time === undefined ? reference + 60 * 60 * 1000 : parseNow(start_time)).toISOString();
  const endTime = new Date(end_time === undefined ? Date.parse(startTime) + duration : parseNow(end_time)).toISOString();
  if (Date.parse(endTime) <= Date.parse(startTime)) throw new Error('Choose an end time after the start.');
  await checkStudyLoad(userId, startTime, endTime, allowHeavyDay);
  const database = await getDatabase();
  await database.runAsync(`
    INSERT INTO StudyBlock (task_id, start_time, end_time, status, rescheduled_from)
    SELECT block.task_id, ?, ?, 'scheduled', block.id
    FROM StudyBlock AS block INNER JOIN Task AS task ON task.id = block.task_id
    WHERE block.id = ? AND task.user_id = ? AND block.status = 'missed'
      AND NOT EXISTS (SELECT 1 FROM StudyBlock AS child WHERE child.rescheduled_from = block.id)
  `, startTime, endTime, blockId, userId);
  const replacement = /** @type {StudyBlock | null} */ (await database.getFirstAsync(
    `${BLOCK_SELECT} WHERE block.rescheduled_from = ? AND task.user_id = ?`, blockId, userId,
  ));
  if (!replacement) throw new Error('This study block is no longer available to reschedule.');
  return replacement;
}
