import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { getDatabase, requireUserId } from './database';
import { DEFAULT_FIELD, DEFAULT_SUBJECT_CODE, normalizeFieldColors, normalizeFieldOfStudy, normalizeSubjectCode } from '../utils/subjectFields';

/**
 * @typedef {{id: number, name: string, subject_code: string, field_of_study: string, field_colors: string}} BackupSubject
 * @typedef {{id: number, subject_id: number, title: string, description: string | null, deadline: string | null, estimated_minutes: number, status: string, postpone_count: number}} BackupTask
 * @typedef {{id: number, task_id: number, start_time: string, end_time: string, status: string, rescheduled_from: number | null, actual_start_time: string | null, break_time_minutes: number, break_started_at: string | null, break_time_ms: number, actual_end_time: string | null, actual_study_seconds: number}} BackupBlock
 * @typedef {{id: number, subject_id: number, study_block_id: number | null, note: string, created_at: string}} BackupReflection
 * @typedef {{id: number, subject_id: number, task_id: number | null, title: string, url_or_note: string | null, local_file_path: string | null}} BackupMaterial
 * @typedef {{subjects: BackupSubject[], tasks: BackupTask[], studyBlocks: BackupBlock[], reflectionItems: BackupReflection[], materials: BackupMaterial[]}} BackupData
 * @typedef {{format: string, version: number, exported_at: string, data: BackupData}} Backup
 */

const FORMAT = 'yotei.study-backup';
const VERSION = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** @param {unknown} value */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value */
const positiveId = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
/** @param {unknown} value */
const nonnegativeInteger = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
/** @param {unknown} value */
const text = value => typeof value === 'string' && value.trim().length > 0;
/** @param {unknown} value */
const nullableText = value => value === null || typeof value === 'string';
/** @param {unknown} value */
const timestamp = value => typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
/** @param {unknown} value */
const nullableTimestamp = value => value === null || timestamp(value);
/** @param {unknown} value */
const fieldColors = value => {
  try { normalizeFieldColors(value); return true; } catch { return false; }
};
/** @param {unknown} value */
const fieldOfStudy = value => {
  try { normalizeFieldOfStudy(value); return true; } catch { return false; }
};
/** @param {unknown} value */
const subjectCode = value => {
  try { normalizeSubjectCode(value); return true; } catch { return false; }
};

/** @type {Record<keyof BackupData, Record<string, (value: unknown) => boolean>>} */
const fields = {
  subjects: { id: positiveId, name: value => text(value) && /** @type {string} */ (value).trim().length <= 128, subject_code: subjectCode, field_of_study: fieldOfStudy, field_colors: fieldColors },
  tasks: { id: positiveId, subject_id: positiveId, title: text, description: value => nullableText(value) && (value === null || /** @type {string} */ (value).length <= 4000), deadline: nullableTimestamp,
    estimated_minutes: positiveId, status: text,
    postpone_count: value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 },
  studyBlocks: { id: positiveId, task_id: positiveId, start_time: timestamp, end_time: timestamp,
    status: value => value === 'scheduled' || value === 'active' || value === 'done' || value === 'missed',
    actual_start_time: nullableTimestamp, break_time_minutes: nonnegativeInteger,
    break_started_at: nullableTimestamp, break_time_ms: nonnegativeInteger,
    actual_end_time: nullableTimestamp, actual_study_seconds: nonnegativeInteger,
    rescheduled_from: value => value === null || positiveId(value) },
  reflectionItems: { id: positiveId, subject_id: positiveId, study_block_id: value => value === null || positiveId(value), note: value => text(value) && /** @type {string} */ (value).length <= 4000, created_at: timestamp },
  materials: { id: positiveId, subject_id: positiveId, task_id: value => value === null || positiveId(value),
    title: text, url_or_note: nullableText, local_file_path: nullableText },
};

/** Validate every record and relationship before opening a write transaction. @param {unknown} input @returns {BackupData} */
function validateBackup(input) {
  if (!record(input)) throw new Error('Choose a valid Yotei JSON backup.');
  const backup = /** @type {Backup} */ (input);
  if (backup.format !== FORMAT || ![1, 2, 3, 4, VERSION].includes(backup.version)) {
    throw new Error('This file is not a supported Yotei backup (versions 1 through 5).');
  }
  if (!timestamp(backup.exported_at) || !record(backup.data)) throw new Error('The backup header is invalid.');
  const data = { ...backup.data };
  if (backup.version === 1 && Array.isArray(data.subjects)) {
    data.subjects = data.subjects.map(row => {
      const legacy = /** @type {{id: number, name: string, color?: unknown}} */ (/** @type {unknown} */ (row));
      if (!record(legacy) || typeof legacy.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(legacy.color)) {
        throw new Error('The backup has an invalid subjects.color value.');
      }
      return { id: legacy.id, name: legacy.name, subject_code: DEFAULT_SUBJECT_CODE, field_of_study: DEFAULT_FIELD, field_colors: legacy.color };
    });
  }
  if (backup.version < 4 && Array.isArray(data.subjects)) {
    data.subjects = data.subjects.map(row => !record(row) ? row : { ...row, subject_code: DEFAULT_SUBJECT_CODE });
  }
  if (backup.version < 3 && Array.isArray(data.studyBlocks)) {
    data.studyBlocks = data.studyBlocks.map(row => !record(row) ? row : { ...row,
      actual_start_time: null, break_time_minutes: 0, break_started_at: null,
      break_time_ms: 0, actual_end_time: null, actual_study_seconds: 0,
    });
  }
  if (backup.version < 5) {
    const legacy = /** @type {{reviewItems?: {id: number, subject_id: number, topic: string, last_reviewed_at: string | null, next_review_at: string | null}[]}} */ (/** @type {unknown} */ (data));
    if (!Array.isArray(legacy.reviewItems)) throw new Error('The legacy backup must contain a reviewItems list.');
    data.reflectionItems = legacy.reviewItems.map(row => {
      if (!record(row) || !text(row.topic) || !nullableTimestamp(row.last_reviewed_at) || !nullableTimestamp(row.next_review_at)) throw new Error('A legacy review item is invalid.');
      return { id: row.id, subject_id: row.subject_id, study_block_id: null, note: row.topic, created_at: row.last_reviewed_at ?? backup.exported_at };
    });
    if (Array.isArray(data.tasks)) data.tasks = data.tasks.map(row => !record(row) ? row : { ...row, description: null });
  }
  for (const name of /** @type {(keyof BackupData)[]} */ (Object.keys(fields))) {
    const rows = data[name];
    if (!Array.isArray(rows)) throw new Error(`The backup must contain a ${name} list.`);
    const ids = new Set();
    for (const row of rows) {
      if (!record(row)) throw new Error(`The ${name} list contains an invalid record.`);
      for (const [key, check] of Object.entries(fields[name])) {
        if (!check(/** @type {Record<string, unknown>} */ (row)[key])) {
          throw new Error(`The backup has an invalid ${name}.${key} value.`);
        }
      }
      if (ids.has(row.id)) throw new Error(`The backup has duplicate ${name} IDs.`);
      ids.add(row.id);
    }
  }
  const subjects = new Set(data.subjects.map(row => row.id));
  const tasks = new Map(data.tasks.map(row => [row.id, row]));
  const blocks = new Map(data.studyBlocks.map(row => [row.id, row]));
  const replaced = new Set();
  const postponements = new Map();
  let activeCount = 0;
  for (const task of data.tasks) {
    if (!subjects.has(task.subject_id)) throw new Error('A task references a subject missing from the backup.');
  }
  for (const block of data.studyBlocks) {
    if (!tasks.has(block.task_id) || Date.parse(block.end_time) <= Date.parse(block.start_time)) {
      throw new Error('A study block has a missing task or invalid time range.');
    }
    if (block.break_time_minutes !== Math.floor(block.break_time_ms / 60000)) throw new Error('A study block has inconsistent break totals.');
    if (block.actual_start_time === null) {
      if (block.status === 'active' || block.break_started_at !== null || block.actual_end_time !== null || block.break_time_ms !== 0 || block.actual_study_seconds !== 0) {
        throw new Error('A study block has timer data without an actual start.');
      }
    } else {
      const started = Date.parse(block.actual_start_time);
      if (!['active', 'done'].includes(block.status) || started < Date.parse(block.start_time) || started >= Date.parse(block.end_time)) {
        throw new Error('A study block has an invalid actual start.');
      }
      if (block.status === 'active') {
        activeCount++;
        if (block.actual_end_time !== null || block.actual_study_seconds !== 0 || (block.break_started_at !== null && Date.parse(block.break_started_at) - started < block.break_time_ms)) {
          throw new Error('An active study block has invalid timer state.');
        }
      } else {
        const elapsed = block.actual_end_time === null ? -1 : Date.parse(block.actual_end_time) - started;
        if (block.break_started_at !== null || elapsed < block.break_time_ms || block.actual_study_seconds !== Math.floor((elapsed - block.break_time_ms) / 1000)) {
          throw new Error('A completed study block has inconsistent studied time.');
        }
      }
    }
    if (block.rescheduled_from !== null) {
      const source = blocks.get(block.rescheduled_from);
      if (!source || source.id === block.id || source.task_id !== block.task_id || source.status !== 'missed' || replaced.has(source.id)) {
        throw new Error('The backup has an invalid rescheduling history.');
      }
      replaced.add(source.id);
      postponements.set(block.task_id, (postponements.get(block.task_id) || 0) + 1);
    }
  }
  if (activeCount > 1) throw new Error('A backup can contain only one active focus session.');
  // Walk each chain once; detect cycles without recursion on large backups.
  const visited = new Set();
  for (const block of data.studyBlocks) {
    const chain = new Set();
    let current = /** @type {BackupBlock | undefined} */ (block);
    while (current && !visited.has(current.id)) {
      if (chain.has(current.id)) throw new Error('The backup has a cycle in its rescheduling history.');
      chain.add(current.id);
      current = current.rescheduled_from === null ? undefined : blocks.get(current.rescheduled_from);
    }
    for (const id of chain) visited.add(id);
  }
  for (const task of data.tasks) {
    if (task.postpone_count < (postponements.get(task.id) || 0)) throw new Error('A task postponement count does not match its history.');
  }
  for (const row of [...data.reflectionItems, ...data.materials]) {
    if (!subjects.has(row.subject_id)) throw new Error('A reflection or material references a subject missing from the backup.');
  }
  for (const reflection of data.reflectionItems) {
    if (reflection.study_block_id !== null && (!blocks.has(reflection.study_block_id) || blocks.get(reflection.study_block_id)?.status !== 'done')) {
      throw new Error('A reflection references a missing or unfinished study session.');
    }
  }
  for (const material of data.materials) {
    if (material.task_id !== null && !tasks.has(material.task_id)) throw new Error('A material references a task missing from the backup.');
  }
  return { ...data, subjects: data.subjects.map(row => ({ ...row,
    field_of_study: normalizeFieldOfStudy(row.field_of_study), field_colors: normalizeFieldColors(row.field_colors),
  })) };
}

function requireNativeBackup() {
  if (Platform.OS === 'web') throw new Error('Use the Android or iOS app to export or import study backups.');
}

/** Export a consistent account-only snapshot and open the native share sheet. @param {string} userId */
export async function exportBackup(userId) {
  requireUserId(userId);
  requireNativeBackup();
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const database = await getDatabase();
  /** @type {BackupData} */
  const data = { subjects: [], tasks: [], studyBlocks: [], reflectionItems: [], materials: [] };
  await database.withExclusiveTransactionAsync(async transaction => {
    data.subjects = await transaction.getAllAsync('SELECT id, name, subject_code, field_of_study, field_colors FROM Subject WHERE user_id = ? ORDER BY id', userId);
    data.tasks = await transaction.getAllAsync(`SELECT id, subject_id, title, description, deadline, estimated_minutes, status, postpone_count
      FROM Task WHERE user_id = ? ORDER BY id`, userId);
    data.studyBlocks = await transaction.getAllAsync(`SELECT b.id, b.task_id, b.start_time, b.end_time, b.status, b.rescheduled_from,
      b.actual_start_time, b.break_time_minutes, b.break_started_at, b.break_time_ms, b.actual_end_time, b.actual_study_seconds
      FROM StudyBlock b JOIN Task t ON t.id = b.task_id WHERE t.user_id = ? ORDER BY b.id`, userId);
    data.reflectionItems = await transaction.getAllAsync(`SELECT r.id, r.subject_id, r.study_block_id, r.note, r.created_at
      FROM ReflectionItem r JOIN Subject s ON s.id = r.subject_id WHERE s.user_id = ? ORDER BY r.id`, userId);
    data.materials = await transaction.getAllAsync(`SELECT m.id, m.subject_id, m.task_id, m.title, m.url_or_note, m.local_file_path
      FROM Material m JOIN Subject s ON s.id = m.subject_id WHERE s.user_id = ? ORDER BY m.id`, userId);
  });
  const exported_at = new Date().toISOString();
  const backup = { format: FORMAT, version: VERSION, exported_at, data };
  // Never produce a file that this app would refuse to restore.
  validateBackup(backup);
  const json = JSON.stringify(backup, null, 2);
  const file = new File(Paths.cache, `yotei-backup-${exported_at.replace(/[:.]/g, '-')}.json`);
  file.create({ overwrite: true });
  try {
    await file.write(json);
    if (file.size > MAX_FILE_BYTES) throw new Error('This backup exceeds the 20 MB import limit.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export Yotei backup' });
  } catch (error) {
    // A failed share is safe to retry. Successful exports stay in cache while
    // receiving applications finish reading; the OS can reclaim them later.
    try { file.delete(); } catch { /* Cleanup must not hide the original error. */ }
    throw error;
  }
  return { uri: file.uri, counts: countsFor(data) };
}

/** @param {BackupData} data */
function countsFor(data) {
  return { subjects: data.subjects.length, tasks: data.tasks.length, studyBlocks: data.studyBlocks.length,
    reflectionItems: data.reflectionItems.length, materials: data.materials.length };
}

/** Pick, validate and atomically replace only the current user's study data. Cancellation returns null. @param {string} userId */
export async function importBackup(userId) {
  requireUserId(userId);
  requireNativeBackup();
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('No backup file was selected.');
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_FILE_BYTES || file.size > MAX_FILE_BYTES) throw new Error('Choose a backup smaller than 20 MB.');
  let parsed;
  try { parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, '')); }
  catch { throw new Error('The selected file could not be read as JSON. Choose a Yotei backup.'); }
  const data = validateBackup(parsed);
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync('DELETE FROM Material WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM ReflectionItem WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM StudyBlock WHERE task_id IN (SELECT id FROM Task WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM Task WHERE user_id = ?', userId);
    await transaction.runAsync('DELETE FROM Subject WHERE user_id = ?', userId);
    // Backup IDs are references only. Allocate fresh local IDs to avoid collisions
    // with other accounts, and bind ownership to the current signed-in account.
    const subjects = new Map();
    const tasks = new Map();
    const blocks = new Map();
    for (const row of data.subjects) {
      const inserted = await transaction.runAsync('INSERT INTO Subject (user_id, name, subject_code, field_of_study, field_colors) VALUES (?, ?, ?, ?, ?)', userId, row.name, normalizeSubjectCode(row.subject_code), row.field_of_study, row.field_colors);
      subjects.set(row.id, inserted.lastInsertRowId);
    }
    for (const row of data.tasks) {
      const inserted = await transaction.runAsync(`INSERT INTO Task (user_id, subject_id, title, description, deadline, estimated_minutes, status, postpone_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, userId, subjects.get(row.subject_id), row.title, row.description, row.deadline, row.estimated_minutes, row.status, row.postpone_count);
      tasks.set(row.id, inserted.lastInsertRowId);
    }
    for (const row of data.studyBlocks) {
      const inserted = await transaction.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, rescheduled_from,
        actual_start_time, break_time_minutes, break_started_at, break_time_ms, actual_end_time, actual_study_seconds)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`, tasks.get(row.task_id), row.start_time, row.end_time, row.status,
      row.actual_start_time, row.break_time_minutes, row.break_started_at, row.break_time_ms, row.actual_end_time, row.actual_study_seconds);
      blocks.set(row.id, inserted.lastInsertRowId);
    }
    // Attach history after insertion: supports any file order and avoids firing
    // the INSERT-only postponement trigger for already-counted reschedules.
    for (const row of data.studyBlocks) {
      if (row.rescheduled_from !== null) await transaction.runAsync(`UPDATE StudyBlock SET rescheduled_from = ?
        WHERE id = ? AND task_id IN (SELECT id FROM Task WHERE user_id = ?)`, blocks.get(row.rescheduled_from), blocks.get(row.id), userId);
    }
    for (const row of data.reflectionItems) {
      await transaction.runAsync(`INSERT INTO ReflectionItem (subject_id, study_block_id, note, created_at) VALUES (?, ?, ?, ?)`,
        subjects.get(row.subject_id), row.study_block_id === null ? null : blocks.get(row.study_block_id), row.note, row.created_at);
    }
    for (const row of data.materials) {
      await transaction.runAsync(`INSERT INTO Material (subject_id, task_id, title, url_or_note, local_file_path) VALUES (?, ?, ?, ?, ?)`,
        subjects.get(row.subject_id), row.task_id === null ? null : tasks.get(row.task_id), row.title, row.url_or_note, row.local_file_path);
    }
  });
  return countsFor(data);
}
