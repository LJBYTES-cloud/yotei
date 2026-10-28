import { getDatabase, requireUserId } from './database';
import { getLocalDayRange } from './dateUtils';
import { checkStudyLoad } from './StudyLoadService';

// Serialize scheduling writes so simultaneous submissions see each other's
// SQLite totals before applying the daily guardrail.
let scheduleQueue = Promise.resolve();
/** @template T @param {() => Promise<T>} action */
function scheduleMutation(action) {
  const result = scheduleQueue.then(action);
  scheduleQueue = result.then(() => {}, () => {});
  return result;
}

/**
 * @typedef {{ id: number, task_id: number, start_time: string, end_time: string,
 * status: 'scheduled' | 'active' | 'done' | 'missed', rescheduled_from: number | null,
 * actual_start_time: string | null, break_time_minutes: number, break_started_at: string | null,
 * break_time_ms: number, actual_end_time: string | null, actual_study_seconds: number,
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
    actual_start_time: null, break_time_minutes: 0, break_started_at: null, break_time_ms: 0, actual_end_time: null, actual_study_seconds: 0,
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
      ${range ? `AND (block.status = 'active' OR (julianday(block.start_time) < julianday(?) AND julianday(block.end_time) > julianday(?))
        ${includeUnresolvedMissed ? "OR (block.status = 'missed' AND replacement.id IS NULL)" : ''})` : ''}
    ORDER BY julianday(block.start_time) ASC, block.id ASC
  `, ...(range ? [userId, range.end, range.start] : [userId]));
}

/** The coach needs history beyond Home's date-filtered list. Untimed legacy
 * completions use their scheduled end; future-dated completions are excluded.
 * @param {string} userId @param {string} [now] @returns {Promise<StudyBlock | null>}
 */
export async function getLatestCompletedStudyBlock(userId, now = new Date().toISOString()) {
  requireUserId(userId);
  const reference = new Date(parseNow(now)).toISOString();
  const database = await getDatabase();
  return database.getFirstAsync(`${BLOCK_SELECT}
    WHERE task.user_id = ? AND block.status = 'done'
      AND julianday(COALESCE(block.actual_end_time, block.end_time)) <= julianday(?)
    ORDER BY julianday(COALESCE(block.actual_end_time, block.end_time)) DESC, block.id DESC
    LIMIT 1
  `, userId, reference);
}

/** Manual completion uses allocated seconds and an honest completion timestamp.
 * A null actual_start_time distinguishes it from a measured timer session.
 * @param {string} userId @param {number} blockId @param {string} [now]
 * @returns {Promise<StudyBlock>}
 */
export function markStudyBlockDone(userId, blockId, now = new Date().toISOString()) {
  return scheduleMutation(async () => {
    requireUserId(userId); requireBlockId(blockId);
    const timestamp = new Date(parseNow(now)).toISOString(), db = await getDatabase();
    let completed = /** @type {StudyBlock | null} */ (null);
    await db.withExclusiveTransactionAsync(async transaction => {
      const block = /** @type {StudyBlock | null} */ (await transaction.getFirstAsync(`${BLOCK_SELECT} WHERE block.id = ? AND task.user_id = ?`, blockId, userId));
      if (!block) throw new Error('Choose a study block belonging to your account.');
      if (block.status === 'done') { completed = block; return; }
      if (block.status !== 'scheduled') throw new Error('Only a scheduled session can be marked done without the timer.');
      const seconds = Math.floor((Date.parse(block.end_time) - Date.parse(block.start_time)) / 1000);
      if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error('This study block has invalid scheduled times.');
      await transaction.runAsync(`UPDATE StudyBlock SET status = 'done', actual_start_time = NULL,
        actual_end_time = ?, actual_study_seconds = ?, break_started_at = NULL, break_time_ms = 0, break_time_minutes = 0
        WHERE id = ? AND status = 'scheduled' AND task_id IN (SELECT id FROM Task WHERE user_id = ?)`, timestamp, seconds, blockId, userId);
      completed = { ...block, status: 'done', actual_start_time: null, actual_end_time: timestamp, actual_study_seconds: seconds,
        break_started_at: null, break_time_ms: 0, break_time_minutes: 0 };
    });
    return /** @type {StudyBlock} */ (completed);
  });
}

/** Delete a not-yet-started session while preserving its task and other blocks.
 * @param {string} userId @param {number} blockId
 */
export function deleteStudyBlock(userId, blockId) {
  return scheduleMutation(async () => {
    requireUserId(userId); requireBlockId(blockId);
    const db = await getDatabase();
    const result = await db.runAsync(`DELETE FROM StudyBlock WHERE id = ? AND status = 'scheduled'
      AND task_id IN (SELECT id FROM Task WHERE user_id = ?)`, blockId, userId);
    if (result.changes !== 1) throw new Error('Choose a scheduled session belonging to your account.');
  });
}

/** @param {string} userId @param {number} blockId @param {string} [now] */
export function startStudyBlock(userId, blockId, now = new Date().toISOString()) {
  return scheduleMutation(() => changeTimer(userId, blockId, 'start', now));
}

/** @param {string} userId @param {number} blockId @param {string} [now] */
export function pauseStudyBlock(userId, blockId, now = new Date().toISOString()) {
  return scheduleMutation(() => changeTimer(userId, blockId, 'break', now));
}

/** @param {string} userId @param {number} blockId @param {string} [now] */
export function resumeStudyBlock(userId, blockId, now = new Date().toISOString()) {
  return scheduleMutation(() => changeTimer(userId, blockId, 'resume', now));
}

/** @param {string} userId @param {number} blockId @param {string} [now] */
export function finishStudyBlock(userId, blockId, now = new Date().toISOString()) {
  return scheduleMutation(() => changeTimer(userId, blockId, 'finish', now));
}

/** Timer transitions and their timing fields commit together. Retrying an
 * already-applied transition preserves the original timestamps/totals.
 * @param {string} userId @param {number} blockId
 * @param {'start' | 'break' | 'resume' | 'finish'} action @param {string} now
 * @returns {Promise<StudyBlock>}
 */
async function changeTimer(userId, blockId, action, now) {
  requireUserId(userId); requireBlockId(blockId);
  const reference = parseNow(now);
  const timestamp = new Date(reference).toISOString();
  const database = await getDatabase();
  let result = /** @type {StudyBlock | null} */ (null);
  await database.withExclusiveTransactionAsync(async transaction => {
    const block = /** @type {StudyBlock | null} */ (await transaction.getFirstAsync(
      `${BLOCK_SELECT} WHERE block.id = ? AND task.user_id = ?`, blockId, userId,
    ));
    if (!block) throw new Error('Choose a study block belonging to your account.');
    if ((action === 'start' && block.status === 'active') || (action === 'finish' && block.status === 'done' && block.actual_start_time !== null)) {
      result = block; return;
    }
    const next = { ...block };
    if (action === 'start') {
      if (block.status !== 'scheduled' || Date.parse(block.start_time) > reference || Date.parse(block.end_time) <= reference) {
        throw new Error('Start this session during its scheduled time. Reschedule a missed session first.');
      }
      const active = await transaction.getFirstAsync(`SELECT block.id FROM StudyBlock block JOIN Task task ON task.id = block.task_id
        WHERE task.user_id = ? AND block.status = 'active' AND block.id <> ? LIMIT 1`, userId, blockId);
      if (active) throw new Error('Finish your active session before starting another.');
      next.status = 'active'; next.actual_start_time = timestamp;
    } else {
      if (block.status !== 'active' || block.actual_start_time === null) throw new Error('Start this session before using the focus timer.');
      if (reference < Date.parse(block.actual_start_time) || (block.break_started_at !== null && reference < Date.parse(block.break_started_at))) {
        throw new Error('The device clock moved backwards. Check the time before continuing.');
      }
      if (action === 'break') {
        next.break_started_at = block.break_started_at ?? timestamp;
      } else {
        if (block.break_started_at !== null) next.break_time_ms += reference - Date.parse(block.break_started_at);
        next.break_started_at = null;
        next.break_time_minutes = Math.floor(next.break_time_ms / 60000);
        if (action === 'finish') {
          next.status = 'done'; next.actual_end_time = timestamp;
          next.actual_study_seconds = Math.max(0, Math.floor((reference - Date.parse(block.actual_start_time) - next.break_time_ms) / 1000));
        }
      }
      if (next.break_time_ms > reference - Date.parse(block.actual_start_time)) {
        throw new Error('The device clock moved backwards. Check the time before continuing.');
      }
    }
    await transaction.runAsync(`UPDATE StudyBlock SET status = ?, actual_start_time = ?, break_time_minutes = ?,
      break_started_at = ?, break_time_ms = ?, actual_end_time = ?, actual_study_seconds = ?
      WHERE id = ? AND task_id IN (SELECT id FROM Task WHERE user_id = ?)`,
    next.status, next.actual_start_time, next.break_time_minutes, next.break_started_at, next.break_time_ms,
    next.actual_end_time, next.actual_study_seconds, blockId, userId);
    result = next;
  });
  return /** @type {StudyBlock} */ (result);
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
