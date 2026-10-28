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
  await s.db.runAsync("INSERT INTO ReflectionItem (subject_id, note, created_at) VALUES (?, ?, '2026-10-20T12:00:00Z')", subject.lastInsertRowId, title);
  await s.db.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.lastInsertRowId, task.lastInsertRowId, title);
  await s.db.runAsync("INSERT INTO JournalEntry (user_id,title,content,created_at) VALUES (?,?,?,'2026-10-20T12:00:00Z')", userId, title, title);
}

async function snapshot(s) {
  const result = {};
  for (const table of ['Subject', 'Task', 'StudyBlock', 'ReflectionItem', 'Material', 'JournalEntry']) result[table] = await s.db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  return result;
}

test('manual scheduled-duration completions round-trip without invented starts; malformed manual timing is rejected', async t => {
  const s = await setup(t); await addAccount(s, 'owner', 'Plan');
  await s.db.runAsync(`UPDATE StudyBlock SET actual_start_time = NULL, actual_end_time = '2026-10-20T14:00:00Z', actual_study_seconds = 1800
    WHERE task_id IN (SELECT id FROM Task WHERE user_id = 'owner')`);
  await s.exportBackup('owner');
  const backup = JSON.parse(s.device.shares.at(-1).json);
  s.pick(backup); await s.importBackup('owner');
  const block = await s.db.getFirstAsync('SELECT * FROM StudyBlock');
  assert.equal(block.actual_start_time, null); assert.equal(block.actual_end_time, '2026-10-20T14:00:00Z'); assert.equal(block.actual_study_seconds, 1800);
  for (const mutate of [b => { b.actual_study_seconds = 1799; }, b => { b.status = 'scheduled'; }, b => { b.break_time_ms = 60000; b.break_time_minutes = 1; }]) {
    const bad = structuredClone(backup); mutate(bad.data.studyBlocks[0]); s.pick(bad);
    const before = await snapshot(s); await assert.rejects(s.importBackup('owner')); assert.deepEqual(await snapshot(s), before);
  }
});

test('version 6 preserves owned manual journal entries and file URIs; version 5 defaults to no manual entries', async t => {
  const s = await setup(t); await addAccount(s, 'owner', 'Study Plan'); await addAccount(s, 'other', 'Private');
  const subject = await s.db.getFirstAsync('SELECT * FROM Subject WHERE user_id = ?', 'owner');
  const uri = 'file:///documents/materials/user-owner/copied.pdf';
  await s.db.runAsync('UPDATE Material SET url_or_note = NULL, local_file_path = ? WHERE subject_id = ?', uri, subject.id);
  await s.exportBackup('owner'); const exported = JSON.parse(s.device.shares.at(-1).json);
  assert.equal(exported.version, 6); assert.equal(exported.data.journalEntries.length, 1);
  assert.equal('user_id' in exported.data.journalEntries[0], false);
  const otherBefore = await s.db.getAllAsync('SELECT * FROM JournalEntry WHERE user_id = ?', 'other');
  s.pick(exported); await s.importBackup('owner');
  assert.equal((await s.db.getFirstAsync('SELECT * FROM JournalEntry WHERE user_id = ?', 'owner')).title, 'Study Plan');
  assert.deepEqual(await s.db.getAllAsync('SELECT * FROM JournalEntry WHERE user_id = ?', 'other'), otherBefore);
  assert.equal((await s.db.getFirstAsync('SELECT * FROM Material WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', 'owner')).local_file_path, uri);
  const before = await snapshot(s);
  for (const change of [data => { delete data.journalEntries; }, data => { data.journalEntries[0].title = ''; },
    data => { data.journalEntries[0].content = 'x'.repeat(12001); }, data => { data.journalEntries[0].created_at = 'bad'; },
    data => { data.journalEntries.push({ ...data.journalEntries[0] }); }]) {
    const bad = structuredClone(exported); change(bad.data); s.pick(bad);
    await assert.rejects(s.importBackup('owner')); assert.deepEqual(await snapshot(s), before);
  }
  const legacy = structuredClone(exported); legacy.version = 5; delete legacy.data.journalEntries;
  s.pick(legacy); await s.importBackup('owner');
  assert.equal((await s.db.getAllAsync('SELECT * FROM JournalEntry WHERE user_id = ?', 'owner')).length, 0);
  assert.deepEqual(await s.db.getAllAsync('SELECT * FROM JournalEntry WHERE user_id = ?', 'other'), otherBefore);
});

test('version 5 round-trips descriptions and linked reflections; version 4 topics migrate and invalid new data rolls back', async t => {
  const s = await setup(t);
  await addAccount(s, 'owner', 'Biology'); await addAccount(s, 'other', 'Private');
  const task = await s.db.getFirstAsync('SELECT * FROM Task WHERE user_id = ?', 'owner');
  const block = await s.db.getFirstAsync('SELECT * FROM StudyBlock WHERE task_id = ?', task.id);
  await s.db.runAsync('UPDATE Task SET description = ? WHERE id = ?', 'Read pages 4-8\nDraw the cell cycle', task.id);
  await s.db.runAsync('UPDATE ReflectionItem SET study_block_id = ?, note = ? WHERE subject_id = ?', block.id, 'Learned the stages.\nPractise the diagram.', task.subject_id);
  await s.exportBackup('owner');
  const exported = JSON.parse(s.device.shares.at(-1).json);
  assert.equal(exported.version, 6); assert.equal('reviewItems' in exported.data, false);
  assert.equal(exported.data.reflectionItems[0].study_block_id, block.id);
  s.pick(exported); await s.importBackup('owner');
  const restored = await s.db.getFirstAsync(`SELECT r.*, t.description, t.user_id FROM ReflectionItem r JOIN StudyBlock b ON b.id = r.study_block_id JOIN Task t ON t.id = b.task_id WHERE t.user_id = ?`, 'owner');
  assert.equal(restored.description, exported.data.tasks[0].description);
  assert.equal(restored.note, exported.data.reflectionItems[0].note);
  assert.notEqual(restored.study_block_id, block.id, 'session IDs are remapped on restore');
  const before = await snapshot(s);
  for (const change of [
    data => { data.tasks[0].description = 4; }, data => { data.tasks[0].description = 'x'.repeat(4001); },
    data => { data.reflectionItems[0].study_block_id = 999; }, data => { data.reflectionItems[0].note = ''; },
    data => { data.reflectionItems[0].created_at = 'not-a-date'; }, data => { delete data.reflectionItems; },
  ]) {
    const bad = structuredClone(exported); change(bad.data); s.pick(bad);
    await assert.rejects(s.importBackup('owner')); assert.deepEqual(await snapshot(s), before);
  }
  const legacy = structuredClone(exported); legacy.version = 4;
  legacy.data.reviewItems = legacy.data.reflectionItems.map(row => ({ id: row.id, subject_id: row.subject_id, topic: row.note, last_reviewed_at: row.created_at, next_review_at: null }));
  delete legacy.data.reflectionItems; delete legacy.data.tasks[0].description;
  s.pick(legacy); await s.importBackup('owner');
  const notes = await s.db.getAllAsync('SELECT r.* FROM ReflectionItem r JOIN Subject s ON s.id = r.subject_id WHERE s.user_id = ?', 'owner');
  assert.equal(notes[0].note, exported.data.reflectionItems[0].note); assert.equal(notes[0].study_block_id, null);
  assert.equal((await s.db.getFirstAsync('SELECT * FROM Task WHERE user_id = ?', 'owner')).description, null);
});

test('export includes all six owned tables, formatted JSON, and native sharing metadata', async t => {
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
  assert.equal(backup.version, 6);
  assert.equal(backup.data.subjects[0].subject_code, 'GEN-101');
  assert.equal(backup.data.subjects[0].field_of_study, 'General');
  assert.equal(backup.data.subjects[0].field_colors, '#C2ACF3');
  assert.equal('color' in backup.data.subjects[0], false);
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
  assert.deepEqual(JSON.parse(JSON.stringify(counts)), { subjects: 1, tasks: 1, studyBlocks: 3, reflectionItems: 2, materials: 2, journalEntries: 0 });
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
  assert.equal(after.ReflectionItem.at(-1).created_at, '2026-10-20T10:00:00.000Z');
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
  'unsupported version': backup => { backup.version = 99; },
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

test('subject codes and fields round-trip in version 4 while legacy backups receive defaults', async t => {
  const s = await setup(t);
  s.pick(fixture());
  await s.importBackup('user');
  let subject = await s.db.getFirstAsync('SELECT * FROM Subject WHERE user_id = ?', 'user');
  assert.equal(subject.field_of_study, 'General');
  assert.equal(subject.field_colors, fixture().data.subjects[0].color);
  assert.equal(subject.subject_code, 'GEN-101');
  await s.db.runAsync('UPDATE Subject SET subject_code = ?, field_of_study = ?, field_colors = ? WHERE id = ?', 'BIO-101', 'Biology, Chemistry', '#2DD4BF,#60A5FA', subject.id);
  await s.exportBackup('user');
  const exported = JSON.parse(s.device.shares.at(-1).json);
  assert.equal(exported.version, 6);
  assert.equal(exported.data.subjects[0].subject_code, 'BIO-101');
  assert.equal(exported.data.subjects[0].field_of_study, 'Biology, Chemistry');
  assert.equal(exported.data.subjects[0].field_colors, '#2DD4BF,#60A5FA');
  s.pick(exported);
  await s.importBackup('user');
  subject = await s.db.getFirstAsync('SELECT * FROM Subject WHERE user_id = ?', 'user');
  assert.equal(subject.subject_code, 'BIO-101');
  assert.equal(subject.field_of_study, 'Biology, Chemistry');
  assert.equal(subject.field_colors, '#2DD4BF,#60A5FA');
  const legacyV2 = structuredClone(exported);
  legacyV2.version = 2; legacyV2.data.reviewItems = fixture().data.reviewItems; delete legacyV2.data.reflectionItems;
  delete legacyV2.data.subjects[0].subject_code;
  for (const block of legacyV2.data.studyBlocks) for (const key of ['actual_start_time', 'break_time_minutes', 'break_started_at', 'break_time_ms', 'actual_end_time', 'actual_study_seconds']) delete block[key];
  s.pick(legacyV2); await s.importBackup('user');
  assert.equal((await s.db.getFirstAsync('SELECT * FROM Subject LIMIT 1')).subject_code, 'GEN-101');
  assert.equal((await s.db.getFirstAsync('SELECT * FROM StudyBlock LIMIT 1')).actual_start_time, null);
  const before = await snapshot(s);
  for (const subject_code of ['', null, 'a'.repeat(33), 'DROP; TABLE']) {
    const invalid = structuredClone(exported); invalid.data.subjects[0].subject_code = subject_code;
    s.pick(invalid); await assert.rejects(s.importBackup('user'));
    assert.deepEqual(await snapshot(s), before);
  }
  for (const value of ['', '#GG0000', '#FF0000,#00FF00,#0000FF', '#FF0000,#ff0000']) {
    const invalid = structuredClone(exported);
    invalid.data.subjects[0].field_colors = value;
    s.pick(invalid);
    await assert.rejects(s.importBackup('user'));
    assert.deepEqual(await snapshot(s), before);
  }
  exported.data.subjects[0].field_of_study = ' , ';
  s.pick(exported);
  await assert.rejects(s.importBackup('user'));
  assert.deepEqual(await snapshot(s), before);
});
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

test('versions 3 and 4 preserve paused timers and frozen actual totals through export and import', async t => {
  const s = await setup(t);
  s.pick(fixture()); await s.importBackup('user');
  const task = await s.db.getFirstAsync('SELECT * FROM Task WHERE user_id = ?', 'user');
  await s.db.runAsync(`UPDATE StudyBlock SET status = 'active', actual_start_time = '2026-10-22T12:13:00Z',
    break_started_at = '2026-10-22T12:18:00Z', break_time_minutes = 1, break_time_ms = 60000 WHERE task_id = ? AND status = 'scheduled'`, task.id);
  await s.db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time,
    break_time_minutes, break_time_ms, actual_study_seconds) VALUES (?, '2026-10-22T10:00:00Z', '2026-10-22T10:30:00Z',
    'done', '2026-10-22T10:00:00Z', '2026-10-22T10:20:00Z', 2, 120000, 1080)`, task.id);
  await s.exportBackup('user');
  const exported = JSON.parse(s.device.shares.at(-1).json);
  assert.equal(exported.version, 6);
  s.pick(exported); await s.importBackup('user');
  const active = await s.db.getFirstAsync("SELECT b.* FROM StudyBlock b JOIN Task t ON t.id = b.task_id WHERE t.user_id = ? AND b.status = 'active'", 'user');
  assert.equal(active.actual_start_time, '2026-10-22T12:13:00Z');
  assert.equal(active.break_started_at, '2026-10-22T12:18:00Z');
  assert.equal(active.break_time_minutes, 1); assert.equal(active.break_time_ms, 60000);
  const done = await s.db.getFirstAsync("SELECT * FROM StudyBlock WHERE status = 'done'");
  assert.equal(done.actual_end_time, '2026-10-22T10:20:00Z'); assert.equal(done.actual_study_seconds, 1080);
  assert.equal(done.break_time_ms, 120000);
  const legacyV3 = structuredClone(exported); legacyV3.version = 3; legacyV3.data.reviewItems = fixture().data.reviewItems; delete legacyV3.data.reflectionItems;
  for (const row of legacyV3.data.subjects) delete row.subject_code;
  s.pick(legacyV3); await s.importBackup('user');
  const legacyActive = await s.db.getFirstAsync("SELECT * FROM StudyBlock WHERE status = 'active'");
  assert.equal(legacyActive.break_started_at, active.break_started_at);
  assert.equal(legacyActive.break_time_ms, active.break_time_ms);
  assert.equal((await s.db.getFirstAsync("SELECT * FROM StudyBlock WHERE status = 'done'")).actual_study_seconds, 1080);
  assert.equal((await s.db.getFirstAsync('SELECT * FROM Subject LIMIT 1')).subject_code, 'GEN-101');
  const before = await snapshot(s);
  const invalidCases = [
    data => { data.studyBlocks.find(block => block.status === 'active').actual_start_time = null; },
    data => { data.studyBlocks.find(block => block.status === 'active').break_time_minutes = 99; },
    data => { data.studyBlocks.find(block => block.status === 'active').break_time_ms = -1; },
    data => { data.studyBlocks.find(block => block.status === 'active').break_started_at = '2026-10-22T12:12:00Z'; },
    data => { data.studyBlocks.find(block => block.status === 'active').actual_end_time = '2026-10-22T12:20:00Z'; },
    data => { data.studyBlocks.find(block => block.status === 'done').actual_study_seconds = 9999; },
    data => { data.studyBlocks.find(block => block.status === 'done').actual_end_time = null; },
    data => { data.studyBlocks.push({ ...data.studyBlocks.find(block => block.status === 'active'), id: 9999, rescheduled_from: null }); },
    data => { delete data.studyBlocks[0].break_time_ms; },
  ];
  for (const invalidate of invalidCases) {
    const bad = structuredClone(exported); invalidate(bad.data); s.pick(bad);
    await assert.rejects(s.importBackup('user'));
    assert.deepEqual(await snapshot(s), before);
  }
});

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
