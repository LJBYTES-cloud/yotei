const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const vm = require('node:vm');

// Real production SQL/transactions; only native picker, files and sharing are
// substituted. The share mock captures the actual file written by the service.
async function setup(t) {
  const native = new DatabaseSync(':memory:');
  t.after(() => native.close());
  const device = { files: new Map(), shares: [], pickerOptions: null, picked: null, available: true, platform: 'ios', writeError: false, shareError: false, failSql: null };
  const connection = {
    execAsync: async sql => native.exec(sql),
    runAsync: async (sql, ...params) => {
      if (device.failSql && sql.includes(device.failSql)) throw new Error('Injected storage failure');
      const result = native.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql, ...params) => native.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => native.prepare(sql).get(...params) ?? null,
    closeAsync: async () => {},
  };
  async function transaction(callback) {
    native.exec('BEGIN');
    try { await callback(connection); native.exec('COMMIT'); }
    catch (error) { native.exec('ROLLBACK'); throw error; }
  }
  connection.withTransactionAsync = transaction;
  connection.withExclusiveTransactionAsync = transaction;
  class File {
    constructor(...parts) { this.uri = parts.join('/'); }
    get size() { return Buffer.byteLength(device.files.get(this.uri) || '', 'utf8'); }
    create() { device.files.set(this.uri, ''); }
    async write(text) {
      if (device.writeError) throw new Error('Disk full');
      device.files.set(this.uri, text);
    }
    async text() {
      if (!device.files.has(this.uri)) throw new Error('File unavailable');
      return device.files.get(this.uri);
    }
    delete() { device.files.delete(this.uri); }
  }
  const context = vm.createContext();
  const modules = new Map();
  function mock(name, exports) {
    modules.set(name, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context }));
  }
  mock('expo-sqlite', { openDatabaseAsync: async () => connection });
  mock('expo-file-system', { File, Paths: { cache: 'file:///cache' } });
  mock('expo-sharing', {
    isAvailableAsync: async () => device.available,
    shareAsync: async (uri, options) => {
      if (device.shareError) throw new Error('Share unavailable');
      device.shares.push({ uri, options, json: device.files.get(uri) });
    },
  });
  mock('expo-document-picker', { getDocumentAsync: async options => {
    device.pickerOptions = options;
    return device.picked || { canceled: true, assets: null };
  } });
  mock('react-native', { Platform: { get OS() { return device.platform; } } });
  async function load(specifier, parent = { identifier: path.resolve('test-entry.js') }) {
    const id = specifier.startsWith('.') ? path.resolve(path.dirname(parent.identifier), specifier) + (path.extname(specifier) ? '' : '.js') : specifier;
    if (modules.has(id)) return modules.get(id);
    const module = new vm.SourceTextModule(fs.readFileSync(id, 'utf8'), { context, identifier: id });
    modules.set(id, module);
    await module.link(load);
    return module;
  }
  const service = await load('./db/BackupService.js');
  await service.evaluate();
  const { getDatabase } = modules.get(path.resolve('db/database.js')).namespace;
  await getDatabase();
  return {
    ...service.namespace, device, db: connection,
    pick: value => {
      device.files.set('file:///picked.json', typeof value === 'string' ? value : JSON.stringify(value));
      device.picked = { canceled: false, assets: [{ uri: 'file:///picked.json', name: 'backup.json' }] };
    },
  };
}

function fixture() {
  return {
    format: 'yotei.study-backup', version: 1, exported_at: '2026-10-21T12:00:00.000Z',
    data: {
      subjects: [{ id: 1, name: 'Mathematics', color: '#C2ACF3' }],
      tasks: [{ id: 1, subject_id: 1, title: "Algebra'); DELETE FROM Task; --", deadline: '2026-10-22', estimated_minutes: 30, status: 'pending', postpone_count: 2 }],
      // Deliberately reversed history: import must not depend on row ordering.
      studyBlocks: [
        { id: 10, task_id: 1, start_time: '2026-10-22T12:00:00.000Z', end_time: '2026-10-22T12:30:00.000Z', status: 'scheduled', rescheduled_from: 9 },
        { id: 9, task_id: 1, start_time: '2026-10-21T12:00:00.000Z', end_time: '2026-10-21T12:30:00.000Z', status: 'missed', rescheduled_from: 8 },
        { id: 8, task_id: 1, start_time: '2026-10-20T12:00:00.000Z', end_time: '2026-10-20T12:30:00.000Z', status: 'missed', rescheduled_from: null },
      ],
      reviewItems: [
        { id: 1, subject_id: 1, topic: 'Quadratic equations', last_reviewed_at: null, next_review_at: null },
        { id: 2, subject_id: 1, topic: 'Functions', last_reviewed_at: '2026-10-20T10:00:00.000Z', next_review_at: '2026-10-27T10:00:00.000Z' },
      ],
      materials: [
        { id: 1, subject_id: 1, task_id: 1, title: 'Worksheet', url_or_note: 'https://example.edu/algebra', local_file_path: 'file:///original-device/worksheet.pdf' },
        { id: 2, subject_id: 1, task_id: null, title: 'Class notes', url_or_note: 'Review chapters 2 and 3.', local_file_path: null },
      ],
    },
  };
}

async function addAccount(s, userId, title) {
  const subject = await s.db.runAsync('INSERT INTO Subject (user_id, name) VALUES (?, ?)', userId, title);
  const task = await s.db.runAsync('INSERT INTO Task (user_id, subject_id, title) VALUES (?, ?, ?)', userId, subject.lastInsertRowId, title);
  await s.db.runAsync("INSERT INTO StudyBlock (task_id, start_time, end_time, status) VALUES (?, '2026-10-20T12:00:00Z', '2026-10-20T12:30:00Z', 'done')", task.lastInsertRowId);
  await s.db.runAsync('INSERT INTO ReviewItem (subject_id, topic) VALUES (?, ?)', subject.lastInsertRowId, title);
  await s.db.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.lastInsertRowId, task.lastInsertRowId, title);
}

async function snapshot(s) {
  const result = {};
  for (const table of ['Subject', 'Task', 'StudyBlock', 'ReviewItem', 'Material']) result[table] = await s.db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  return result;
}

test('export includes all five owned tables, formatted JSON, and native sharing metadata', async t => {
  const s = await setup(t);
  await addAccount(s, 'user-a', 'Owned data');
  await addAccount(s, 'user-b', 'Private other account');
  const result = await s.exportBackup('user-a');
  const shared = s.device.shares[0];
  assert.equal(result.uri, shared.uri);
  assert.match(shared.uri, /yotei-backup-.*\.json$/);
  assert.equal(shared.options.mimeType, 'application/json');
  assert.equal(shared.options.UTI, 'public.json');
  assert.match(shared.json, /\n  "format"/);
  assert.doesNotMatch(shared.json, /Private other account|user-a|user-b|password|session/i);
  const backup = JSON.parse(shared.json);
  assert.equal(backup.format, 'yotei.study-backup');
  assert.equal(backup.version, 1);
  for (const rows of Object.values(backup.data)) assert.equal(rows.length, 1);
  assert.equal(backup.data.studyBlocks[0].status, 'done');
});

test('import remaps all foreign keys, preserves counts/history/timestamps/materials, and isolates accounts', async t => {
  const s = await setup(t);
  await addAccount(s, 'other-user', 'Keep these records');
  const other = await snapshot(s);
  await addAccount(s, 'restore-user', 'Replace these records');
  const backup = fixture();
  // Source ownership metadata, if present, is never trusted on restore.
  backup.data.subjects[0].user_id = 'other-user';
  backup.data.tasks[0].user_id = 'other-user';
  s.pick(backup);
  const counts = await s.importBackup('restore-user');
  assert.deepEqual(JSON.parse(JSON.stringify(counts)), { subjects: 1, tasks: 1, studyBlocks: 3, reviewItems: 2, materials: 2 });
  assert.equal(s.device.pickerOptions.copyToCacheDirectory, true);
  assert.equal(s.device.pickerOptions.multiple, false);
  const after = await snapshot(s);
  for (const table of Object.keys(other)) assert.deepEqual(after[table].slice(0, 1), other[table], `other account's ${table} records survive`);
  const task = after.Task.find(row => row.user_id === 'restore-user');
  assert.notEqual(task.id, 1);
  assert.equal(task.postpone_count, 2, 'historical inserts must not fire fresh postponements');
  assert.equal(task.title, backup.data.tasks[0].title, 'SQL-like text is bound as data');
  const blocks = after.StudyBlock.filter(row => row.task_id === task.id);
  const newest = blocks.find(row => row.status === 'scheduled');
  const middle = blocks.find(row => row.id === newest.rescheduled_from);
  const oldest = blocks.find(row => row.id === middle.rescheduled_from);
  assert.equal(oldest.rescheduled_from, null);
  assert.equal(newest.start_time, backup.data.studyBlocks[0].start_time);
  const materials = after.Material.filter(row => row.subject_id === task.subject_id);
  assert.equal(materials[0].task_id, task.id);
  assert.equal(materials[0].local_file_path, backup.data.materials[0].local_file_path);
  assert.equal(materials[1].task_id, null);
  assert.equal(after.ReviewItem.at(-1).next_review_at, '2026-10-27T10:00:00.000Z');
  assert.deepEqual(await s.db.getAllAsync('PRAGMA foreign_key_check'), []);
  // Round-trip through the actual file exporter, not just a hand-built fixture.
  await s.exportBackup('restore-user');
  s.pick(s.device.shares.at(-1).json);
  await s.importBackup('restore-user');
  const restoredTask = await s.db.getFirstAsync('SELECT * FROM Task WHERE user_id = ?', 'restore-user');
  assert.equal(restoredTask.postpone_count, 2);
  const source = await s.db.getFirstAsync("SELECT * FROM StudyBlock WHERE task_id = ? AND status = 'scheduled'", restoredTask.id);
  await s.db.runAsync("UPDATE StudyBlock SET status = 'missed' WHERE id = ?", source.id);
  await s.db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, rescheduled_from)
    VALUES (?, '2026-10-23T12:00:00Z', '2026-10-23T12:30:00Z', 'scheduled', ?)`, restoredTask.id, source.id);
  assert.equal((await s.db.getFirstAsync('SELECT postpone_count FROM Task WHERE id = ?', restoredTask.id)).postpone_count, 3,
    'new reschedules still increment once after restoring history');
});

const invalidCases = {
  'malformed JSON': () => '{broken',
  'wrong format': backup => { backup.format = 'something-else'; },
  'unsupported version': backup => { backup.version = 2; },
  'missing collection': backup => { delete backup.data.materials; },
  'wrong field type': backup => { backup.data.tasks[0].postpone_count = '2'; },
  'duplicate ID': backup => { backup.data.subjects.push({ ...backup.data.subjects[0] }); },
  'missing subject': backup => { backup.data.tasks[0].subject_id = 99; },
  'missing task': backup => { backup.data.studyBlocks[0].task_id = 99; },
  'invalid duration': backup => { backup.data.studyBlocks[0].end_time = backup.data.studyBlocks[0].start_time; },
  'invalid timestamp': backup => { backup.data.reviewItems[0].next_review_at = 'not-a-date'; },
  'missing review subject': backup => { backup.data.reviewItems[0].subject_id = 99; },
  'missing material task': backup => { backup.data.materials[0].task_id = 99; },
  'missing history source': backup => { backup.data.studyBlocks[0].rescheduled_from = 99; },
  'repeated replacement': backup => { backup.data.studyBlocks[0].rescheduled_from = 8; },
  'cyclic history': backup => { backup.data.studyBlocks[0].rescheduled_from = null; backup.data.studyBlocks[2].rescheduled_from = 9; },
  'inconsistent count': backup => { backup.data.tasks[0].postpone_count = 1; },
};
for (const [name, change] of Object.entries(invalidCases)) {
  test(`invalid import leaves existing data untouched: ${name}`, async t => {
    const s = await setup(t);
    await addAccount(s, 'user', 'Existing data');
    const before = await snapshot(s);
    const backup = fixture();
    s.pick(change(backup) || backup);
    await assert.rejects(s.importBackup('user'));
    assert.deepEqual(await snapshot(s), before);
  });
}

test('mid-import SQL failure rolls back deleted records and every partial insertion', async t => {
  const s = await setup(t);
  await addAccount(s, 'user', 'Keep after failed import');
  const before = await snapshot(s);
  s.pick(fixture());
  s.device.failSql = 'INSERT INTO Material';
  await assert.rejects(s.importBackup('user'), /Injected storage failure/);
  assert.deepEqual(await snapshot(s), before);
});

test('picker cancellation is a no-op and an empty backup intentionally clears only its destination account', async t => {
  const s = await setup(t);
  await addAccount(s, 'user', 'Current account');
  await addAccount(s, 'other', 'Other account');
  const before = await snapshot(s);
  assert.equal(await s.importBackup('user'), null);
  assert.deepEqual(await snapshot(s), before);
  const backup = fixture();
  for (const key of Object.keys(backup.data)) backup.data[key] = [];
  s.pick('\uFEFF' + JSON.stringify(backup));
  await s.importBackup('user');
  const after = await snapshot(s);
  for (const rows of Object.values(after)) assert.equal(rows.length, 1);
  assert.equal(after.Subject[0].user_id, 'other');
});

test('oversized files and missing user IDs are rejected without replacing data', async t => {
  const s = await setup(t);
  await addAccount(s, 'user', 'Keep');
  const before = await snapshot(s);
  s.pick(fixture());
  s.device.picked.assets[0].size = 21 * 1024 * 1024;
  await assert.rejects(s.importBackup('user'), /20 MB/);
  await assert.rejects(s.importBackup(''), /Sign in/);
  await assert.rejects(s.exportBackup(''), /Sign in/);
  assert.deepEqual(await snapshot(s), before);
});

test('write/share errors clean temporary exports and preserve study data; unavailable/web is explicit', async t => {
  const s = await setup(t);
  await addAccount(s, 'user', 'Keep');
  const before = await snapshot(s);
  s.device.writeError = true;
  await assert.rejects(s.exportBackup('user'), /Disk full/);
  assert.equal(s.device.files.size, 0);
  s.device.writeError = false;
  s.device.shareError = true;
  await assert.rejects(s.exportBackup('user'), /Share unavailable/);
  assert.equal(s.device.files.size, 0);
  s.device.available = false;
  await assert.rejects(s.exportBackup('user'), /unavailable on this device/);
  s.device.platform = 'web';
  await assert.rejects(s.importBackup('user'), /Android or iOS/);
  await assert.rejects(s.exportBackup('user'), /Android or iOS/);
  assert.deepEqual(await snapshot(s), before);
});
