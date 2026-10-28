const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const vm = require('node:vm');

// Execute the production services against real SQLite. Only Expo's native
// transport is replaced, so SQL, constraints, transactions and joins are real.
async function loadServices(filename = ':memory:', failFirstInitialization = false, now, failSql) {
  class FixedDate extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(now);
    }
    static now() { return Date.parse(now); }
  }
  const context = vm.createContext(now ? { Date: FixedDate, URL } : { URL });
  const connections = [];
  let opens = 0;
  const prepared = [], finalized = [];
  const sqlite = new vm.SyntheticModule(['openDatabaseAsync'], function () {
    this.setExport('openDatabaseAsync', async name => {
      assert.equal(name, 'yotei.db');
      opens += 1;
      const native = new DatabaseSync(filename);
      let closed = false;
      const connection = {
        execAsync: async sql => {
          if (failSql && sql.includes(failSql)) throw new Error('Migration write failed');
          if (failFirstInitialization) {
            failFirstInitialization = false;
            throw new Error('Storage unavailable');
          }
          native.exec(sql);
        },
        withTransactionAsync: async callback => {
          native.exec('BEGIN');
          try {
            await callback();
            native.exec('COMMIT');
          } catch (error) {
            native.exec('ROLLBACK');
            throw error;
          }
        },
        withExclusiveTransactionAsync: async callback => {
          native.exec('BEGIN');
          try {
            await callback(connection);
            native.exec('COMMIT');
          } catch (error) {
            native.exec('ROLLBACK');
            throw error;
          }
        },
        runAsync: async (sql, ...params) => {
          const result = native.prepare(sql).run(...params);
          return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
        },
        prepareAsync: async sql => {
          prepared.push(sql);
          const statement = native.prepare(sql);
          return {
            executeAsync: async values => {
              const result = statement.run(...values);
              return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
            },
            finalizeAsync: async () => { finalized.push(sql); },
          };
        },
        getAllAsync: async (sql, ...params) => native.prepare(sql).all(...params),
        getFirstAsync: async (sql, ...params) => native.prepare(sql).get(...params) ?? null,
        closeAsync: async () => {
          if (!closed) { native.close(); closed = true; }
        },
      };
      connections.push(connection);
      return connection;
    });
  }, { context });
  const modules = new Map([['expo-sqlite', sqlite]]);
  async function load(specifier, parent) {
    const identifier = specifier.startsWith('.')
      ? path.resolve(path.dirname(parent.identifier), specifier) + (path.extname(specifier) ? '' : '.js')
      : specifier;
    if (modules.has(identifier)) return modules.get(identifier);
    const module = new vm.SourceTextModule(fs.readFileSync(identifier, 'utf8'), { context, identifier });
    modules.set(identifier, module);
    await module.link(load);
    return module;
  }
  const parent = { identifier: path.resolve('test-entry.js') };
  const subjects = await load('./db/SubjectService.js', parent);
  await subjects.evaluate();
  const tasks = await load('./db/TaskService.js', parent);
  await tasks.evaluate();
  const blocks = await load('./db/StudyBlockService.js', parent);
  await blocks.evaluate();
  const dates = modules.get(path.resolve('db/dateUtils.js')).namespace;
  const loadService = modules.get(path.resolve('db/StudyLoadService.js')).namespace;
  const scheduling = await load('./utils/scheduling.js', parent);
  await scheduling.evaluate();
  const demo = await load('./db/seedData.js', parent);
  await demo.evaluate();
  const reviews = await load('./db/ReflectionService.js', parent);
  await reviews.evaluate();
  const materials = await load('./db/MaterialService.js', parent);
  await materials.evaluate();
  const journal = await load('./db/JournalService.js', parent); await journal.evaluate();
  const progress = await load('./db/ProgressService.js', parent);
  await progress.evaluate();
  const database = modules.get(path.resolve('db/database.js')).namespace;
  const subjectFields = modules.get(path.resolve('utils/subjectFields.js')).namespace;
  const timer = await load('./utils/focusTimer.js', parent);
  await timer.evaluate();
  const coaching = await load('./utils/coaching.js', parent); await coaching.evaluate();
  const chartAxis = await load('./utils/progressChart.js', parent); await chartAxis.evaluate();
  const coachService = await load('./db/CoachService.js', parent); await coachService.evaluate();
  return {
    ...subjects.namespace, ...tasks.namespace, ...blocks.namespace, ...dates, ...database, ...loadService, ...scheduling.namespace, ...demo.namespace, ...reviews.namespace, ...subjectFields, ...timer.namespace, ...progress.namespace, ...materials.namespace, ...journal.namespace,
    ...modules.get(path.resolve('utils/materialLinks.js')).namespace,
    ...coaching.namespace, ...chartAxis.namespace, ...coachService.namespace,
    setNow: value => { now = value; },
    get opens() { return opens; },
    prepared, finalized,
    close: async () => { for (const connection of connections) await connection.closeAsync(); },
  };
}

const plain = value => JSON.parse(JSON.stringify(value));

test('scheduled blocks complete manually once, credit the completion day and preserve tasks', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T12:00:00'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Cells' });
  const now = new Date('2026-10-20T12:00:00').toISOString();
  const start = new Date('2026-10-21T17:00:00'), end = new Date('2026-10-21T17:45:00');
  const block = await s.createStudyBlock('owner', { task_id: task.id, start_time: start.toISOString(), end_time: end.toISOString() });
  await assert.rejects(s.markStudyBlockDone('other', block.id, now), /account/i);
  const [first, retry] = await Promise.all([s.markStudyBlockDone('owner', block.id, now), s.markStudyBlockDone('owner', block.id, new Date(Date.parse(now) + 60000).toISOString())]);
  assert.equal(first.status, 'done'); assert.equal(first.actual_start_time, null);
  assert.equal(first.actual_end_time, now); assert.equal(retry.actual_end_time, now);
  assert.equal(first.actual_study_seconds, 2700); assert.equal(first.break_time_ms, 0);
  const week = await s.getWeeklyStudyMinutes('owner', '2026-10-20');
  assert.equal(week.at(-1).minutes, 45, 'credit now rather than the future scheduled day');
  const details = await s.getStudyDayDetails('owner', '2026-10-20');
  assert.equal(details[0].studied_minutes, 45); assert.equal(details[0].elapsed_minutes, 45);
  assert.equal(details[0].overrun_minutes, 0); assert.equal(details[0].finished_late_minutes, 0);
  assert.equal((await s.getTasksForUser('owner'))[0].id, task.id);
  await assert.rejects(s.deleteStudyBlock('owner', block.id), /scheduled/i);
  const next = await s.createStudyBlock('owner', { task_id: task.id, start_time: start.toISOString(), end_time: end.toISOString() });
  await assert.rejects(s.deleteStudyBlock('other', next.id), /account/i);
  await s.deleteStudyBlock('owner', next.id);
  assert.deepEqual((await s.getStudyBlocksForUser('owner')).map(row => row.id), [block.id]);
  assert.equal((await s.getTasksForUser('owner'))[0].latest_scheduled_start, null);
  for (const id of [0, -1, NaN, '1']) {
    await assert.rejects(s.deleteStudyBlock('owner', id));
    await assert.rejects(s.markStudyBlockDone('owner', id, now));
  }
  const missed = await s.createStudyBlock('owner', { task_id: task.id, start_time: start.toISOString(), end_time: end.toISOString() });
  await s.updateStudyBlockStatus('owner', missed.id, 'missed');
  await assert.rejects(s.markStudyBlockDone('owner', missed.id, now), /scheduled/i);
  await assert.rejects(s.deleteStudyBlock('owner', missed.id), /scheduled/i);
});

test('journal management updates/deletes both owned sources without changing dates or study history', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T12:00:00'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Cells' });
  const block = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' });
  await s.markStudyBlockDone('owner', block.id);
  const reflection = await s.createReflectionItem('owner', { subject_id: subject.id, study_block_id: block.id, note: 'First note' });
  const entry = await s.createJournalEntry('owner', { title: 'Plan', content: 'First plan' });
  for (const [id, kind] of [[entry.id, 'entry'], [reflection.id, 'reflection']]) {
    await assert.rejects(s.updateJournalEntry('other', id, { title: 'Private', content: 'Changed' }, kind), /account/i);
    await assert.rejects(s.deleteJournalEntry('other', id, kind), /account/i);
    await assert.rejects(s.updateJournalEntry('owner', id, { title: 'Title', content: ' ' }, kind));
    await assert.rejects(s.updateJournalEntry('owner', id, { title: 'Title', content: 'x'.repeat(kind === 'entry' ? 12001 : 4001) }, kind));
  }
  await s.updateJournalEntry('owner', entry.id, { title: "  Plan'); DROP TABLE Task; --  ", content: '  Revised plan  ' });
  await s.updateJournalEntry('owner', reflection.id, { content: '  Revised reflection  ' }, 'reflection');
  const feed = await s.getJournalFeedForUser('owner');
  assert.equal(feed.find(row => row.kind === 'entry').content, 'Revised plan');
  assert.equal(feed.find(row => row.kind === 'entry').created_at, entry.created_at);
  assert.equal(feed.find(row => row.kind === 'reflection').created_at, reflection.created_at);
  assert.equal(feed.find(row => row.kind === 'reflection').content, 'Revised reflection');
  assert.equal((await s.getTasksForUser('owner'))[0].title, 'Cells', 'reflection editing does not rename the task');
  await s.deleteJournalEntry('owner', reflection.id, 'reflection');
  await s.deleteJournalEntry('owner', entry.id);
  assert.equal((await s.getJournalFeedForUser('owner')).length, 0);
  assert.equal((await s.getStudyBlocksForUser('owner'))[0].status, 'done');
  await assert.rejects(s.deleteJournalEntry('owner', entry.id));
  await assert.rejects(s.updateJournalEntry('owner', 0, { content: 'x' }, 'reflection'));
  await assert.rejects(s.deleteJournalEntry('owner', entry.id, 'bad-kind'));
});

test('coach streaks count local completion days and best-hour aggregation remains account-scoped', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T20:00:00'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Cells' });
  const db = await s.getDatabase();
  assert.deepEqual(plain(await s.getCoachHistory('owner', '2026-10-20')), { completedToday: false, completedYesterday: false, bestHour: null });
  const otherSubject = await s.createSubject('other', { name: 'Private' });
  const otherTask = await s.createTask('other', { subject_id: otherSubject.id, title: 'Private Task' });
  for (const day of ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']) {
    for (const [id, hour, work] of [[task.id, 9, 1800], [otherTask.id, 15, 7200]]) {
      const start = new Date(`${day}T${hour.toString().padStart(2, '0')}:00:00`), end = new Date(start.getTime() + work * 1000);
      await db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time, actual_study_seconds)
        VALUES (?, ?, ?, 'done', ?, ?, ?)`, id, start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString(), work);
    }
  }
  assert.deepEqual(plain(await s.getCoachHistory('owner', '2026-10-20')), { completedToday: true, completedYesterday: true, bestHour: 9 });
  assert.equal((await s.getCoachHistory('other', '2026-10-20')).bestHour, 15);
  const future = new Date('2026-10-21T00:00:00').toISOString();
  const summary = await s.getCoachHistory('owner', '2026-10-21', future);
  assert.equal(summary.completedToday, false); assert.equal(summary.completedYesterday, true);
  await assert.rejects(s.getCoachHistory(' ', '2026-10-20'));
  await assert.rejects(s.getCoachHistory('owner', 'bad date'));
});

test('coach productive-hour bins use each historical instant across DST and fractional-hour timezones', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Cells' });
  const db = await s.getDatabase();
  for (const date of ['2026-10-31', '2026-11-01', '2026-11-02']) {
    const start = new Date(`${date}T09:45:00`), end = new Date(start.getTime() + 1800000);
    await db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time, actual_study_seconds)
      VALUES (?, ?, ?, 'done', ?, ?, 1800)`, task.id, start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString());
  }
  const summary = await s.getCoachHistory('owner', '2026-11-02', new Date('2026-11-02T20:00:00').toISOString());
  assert.equal(summary.bestHour, 9); assert.equal(summary.completedToday, true); assert.equal(summary.completedYesterday, true);
});

test('coach prioritizes overdue, postponement, workload, calendar streak, then best time', async t => {
  const s = await loadServices(); t.after(s.close);
  const now = new Date('2026-10-20T12:00:00').getTime();
  const input = { tasks: [], scheduledMinutes: 240, history: { completedToday: false, completedYesterday: false, bestHour: null }, now };
  assert.equal(s.selectCoachMessage(input), null);
  input.history = { completedToday: true, completedYesterday: true, bestHour: 9 };
  input.bestHourLabel = '09:00';
  assert.equal(s.selectCoachMessage(input).rule, 'streak');
  assert.equal(s.selectCoachMessage(input).message, "You're on a 2-day streak! Keep the momentum going.");
  input.history = { ...input.history, completedYesterday: false };
  assert.equal(s.selectCoachMessage(input).rule, 'best-time');
  assert.match(s.selectCoachMessage(input).message, /09:00/);
  input.scheduledMinutes = 240.01;
  assert.equal(s.selectCoachMessage(input).rule, 'burnout');
  input.tasks = [{ id: 8, title: 'Essay Draft', postpone_count: 2 }, { id: 6, title: 'Read Chapter 4', postpone_count: 3 }];
  const order = input.tasks.map(task => task.id);
  assert.equal(s.selectCoachMessage(input).message, "I noticed you've been postponing Read Chapter 4. Try a 5-minute micro-action to break the friction.");
  assert.deepEqual(input.tasks.map(task => task.id), order);
  input.tasks.push({ id: 1, title: 'Old Assignment', deadline: '2026-10-19', subject_name: 'Biology', status: 'pending', postpone_count: 0 });
  assert.equal(s.selectCoachMessage(input).message, "You have an overdue task in Biology. Let's reschedule it to avoid burnout.");
  input.tasks[2].status = 'done';
  assert.equal(s.selectCoachMessage(input).rule, 'procrastination');
  input.tasks = [{ id: 1, title: 'Due Today', deadline: '2026-10-20', status: 'pending', postpone_count: 0 }];
  input.scheduledMinutes = 240;
  assert.equal(s.selectCoachMessage(input).rule, 'best-time', 'date-only deadlines include the entire local due day');
  input.tasks[0].deadline = new Date(now - 1).toISOString();
  assert.equal(s.selectCoachMessage(input).rule, 'overdue', 'timestamp deadlines expire at their exact instant');
  input.tasks[0].deadline = new Date(now).toISOString();
  assert.equal(s.selectCoachMessage(input).rule, 'best-time');
  input.tasks = []; input.history.bestHour = null;
  assert.equal(s.selectCoachMessage(input), null);
});

test('coach history reads owned completed sessions across all dates, preferring actual completion time', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T12:00:00Z'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Cells' });
  const otherSubject = await s.createSubject('other', { name: 'Private' });
  const otherTask = await s.createTask('other', { subject_id: otherSubject.id, title: 'Private Work' });
  const db = await s.getDatabase();
  async function insert(taskId, start, end, status, actualEnd = null, seconds = 0) {
    return db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time, actual_study_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, taskId, start, end, status, actualEnd === null ? null : start, actualEnd, seconds);
  }
  assert.equal(await s.getLatestCompletedStudyBlock('owner'), null);
  await insert(otherTask.id, '2026-10-20T11:00:00Z', '2026-10-20T11:45:00Z', 'done', '2026-10-20T11:59:00Z', 3540);
  const older = await insert(task.id, '2026-10-15T09:00:00Z', '2026-10-15T09:30:00Z', 'done');
  assert.equal((await s.getLatestCompletedStudyBlock('owner')).id, older.lastInsertRowId);
  assert.equal((await s.getStudyBlocksForUser('owner', { date: '2026-10-20' })).length, 0, 'coach history is independent of the Home date filter');
  const completed = await insert(task.id, '2026-10-19T10:00:00Z', '2026-10-19T10:30:00Z', 'done', '2026-10-20T10:15:00Z', 2701);
  const ignored = [];
  for (const status of ['scheduled', 'active', 'missed']) ignored.push(await insert(task.id, '2026-10-20T11:00:00Z', '2026-10-20T11:45:00Z', status));
  await insert(task.id, '2026-10-21T09:00:00Z', '2026-10-21T09:30:00Z', 'done', '2026-10-21T09:45:00Z', 2700);
  let latest = await s.getLatestCompletedStudyBlock('owner');
  assert.equal(latest.id, completed.lastInsertRowId); assert.equal(latest.task_title, 'Cells');
  assert.equal(latest.actual_study_seconds, 2701);
  const tied = await insert(task.id, '2026-10-20T09:00:00Z', '2026-10-20T10:00:00Z', 'done', '2026-10-20T10:15:00Z', 3600);
  latest = await s.getLatestCompletedStudyBlock('owner');
  assert.equal(latest.id, tied.lastInsertRowId, 'equal completion instants use ID order');
  assert.equal((await s.getLatestCompletedStudyBlock('owner', '2026-10-19T12:00:00Z')).id, older.lastInsertRowId);
  assert.equal(await s.getLatestCompletedStudyBlock("owner' OR 1=1 --"), null, 'query values are bound');
  await assert.rejects(s.getLatestCompletedStudyBlock(' '), /Sign in/i);
  await assert.rejects(s.getLatestCompletedStudyBlock('owner', 'bad date'), /reference time/i);
});

test('chart axes round up to whole hours with bounded clean intervals and retain zero-day values', async t => {
  const s = await loadServices(); t.after(s.close);
  for (const [minutes, maximum, segments, step] of [
    [[0, 0, 0], 60, 1, 60], [[38, 76], 120, 2, 60], [[240, 270.5], 300, 5, 60],
    [[360], 360, 6, 60], [[361], 480, 4, 120], [[1440], 1440, 6, 240],
  ]) {
    const values = [...minutes];
    assert.deepEqual(plain(s.getProgressAxis(values)), { maximum, segments, step });
    assert.deepEqual(values, minutes, 'axis scaling never alters actual chart data');
    for (let index = 1; index <= segments; index++) assert.match(s.formatProgressAxisLabel(String(index * step)), /^\d+h$/);
  }
  assert.equal(s.formatProgressAxisLabel('0'), '0');
  assert.equal(s.formatProgressAxisLabel('60'), '1h');
  assert.equal(s.formatProgressAxisLabel('120'), '2h');
  assert.equal(s.formatProgressAxisLabel('90'), '1h 30m');
});

test('lateness is derived only for completion and distinguishes exact, subminute and absent starts', async t => {
  const s = await loadServices(); t.after(s.close);
  const block = { start_time: '2026-10-20T09:00:00Z', actual_start_time: '2026-10-20T09:13:45Z' };
  assert.equal(s.getCompletionStartMessage(block), 'Session complete! You started 13 minutes late.');
  block.actual_start_time = '2026-10-20T09:00:30Z';
  assert.equal(s.getCompletionStartMessage(block), 'Session complete! You started less than a minute late.');
  block.actual_start_time = block.start_time;
  assert.equal(s.getCompletionStartMessage(block), 'You started exactly on time!');
  block.actual_start_time = null;
  assert.equal(s.getCompletionStartMessage(block), 'Session complete!');
  const timing = s.getFocusTiming({ ...block, actual_end_time: null, break_started_at: null, break_time_ms: 0, actual_study_seconds: 0 });
  assert.equal('lateMinutes' in timing || 'startedLate' in timing, false, 'live timing does not calculate lateness');
});

test('manual journal entries and session reflections form an owned, newest-first feed with unique keys', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T10:00:00Z'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const reflection = await s.createReflectionItem('owner', { subject_id: subject.id, note: 'I can explain mitosis.' });
  s.setNow('2026-10-21T10:00:00Z');
  const entry = await s.createJournalEntry('owner', { title: "Plan'); DROP TABLE JournalEntry; --", content: '  Revise cells.\nPractise diagrams.  ' });
  await s.createJournalEntry('other', { title: 'Private', content: 'Not shared' });
  const feed = await s.getJournalFeedForUser('owner');
  assert.deepEqual(plain(feed.map(item => [item.id, item.kind])), [[`entry-${entry.id}`, 'entry'], [`reflection-${reflection.id}`, 'reflection']]);
  assert.equal(feed[0].content, 'Revise cells.\nPractise diagrams.');
  assert.equal(feed[1].subject_name, 'Biology');
  assert.equal((await s.getJournalFeedForUser('other')).length, 1);
  for (const input of [{ title: '', content: 'x' }, { title: 'x', content: '' }, { title: 'x'.repeat(201), content: 'x' }, { title: 'x', content: 'x'.repeat(12001) }]) await assert.rejects(s.createJournalEntry('owner', input));
  await assert.rejects(s.getJournalFeedForUser(' '));
  await s.deleteSubject('owner', subject.id);
  assert.equal((await s.getJournalFeedForUser('owner')).length, 1, 'manual notes survive subject deletion');
});

test('picked material locations persist in local_file_path and remain owned', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const uri = 'file:///documents/materials/user-owner/notes.pdf';
  const id = await s.createMaterial('owner', subject.id, { title: 'Notes', location: uri, local_file_path: uri });
  const material = (await s.getMaterialsForUser('owner'))[0];
  assert.equal(material.local_file_path, uri); assert.equal(material.url_or_note, null);
  await assert.rejects(s.updateMaterial('other', id, { title: 'Bad', location: uri, local_file_path: uri }));
  await s.updateMaterial('owner', id, { title: 'Website', location: 'https://example.com' });
  assert.equal((await s.getMaterialsForUser('owner'))[0].local_file_path, null);
});

test('six-calendar-month demo spans month ends with unique assignments, honest timing and varied notes', async t => {
  const s = await loadServices(':memory:', false, '2026-05-31T12:00:00'); t.after(s.close);
  await s.createJournalEntry('other', { title: 'Private Plan', content: 'Keep this' });
  const counts = await s.seedDemoData('owner');
  assert.equal(counts.historyDays, 182); // November 30 through May 30, inclusive.
  const journal = await s.getJournalEntriesForUser('owner');
  assert.equal(s.getLocalDateKey(new Date(journal.at(-1).created_at)), '2025-11-30');
  assert.equal((await s.getJournalEntriesForUser('other'))[0].title, 'Private Plan');
  const blocks = await s.getStudyBlocksForUser('owner');
  const subjects = await s.getSubjectsForUser('owner'), tasks = await s.getTasksForUser('owner');
  assert.equal(subjects.length, 20); assert.equal(new Set(subjects.map(subject => subject.name)).size, 20);
  assert.equal(new Set(subjects.map(subject => subject.field_of_study)).size, 5);
  assert.equal(tasks.length, 40); assert.equal(new Set(tasks.map(task => task.title)).size, 40);
  assert.equal(new Set(blocks.map(block => block.task_id)).size, 40, 'all assignments appear in session history');
  assert.ok(blocks.filter(block => block.status === 'done').length >= 280);
  assert.equal(new Set(journal.map(entry => entry.content)).size, journal.length);
  assert.equal(new Set(journal.map(entry => entry.title)).size, journal.length);
  const reflections = await s.getReflectionsForUser('owner');
  assert.equal(new Set(reflections.map(item => item.note)).size, reflections.length);
  assert.equal(new Set(reflections.map(item => item.subject_id)).size, 20);
  assert.ok(reflections.some(item => /phone/.test(item.note)) && reflections.some(item => /flow state/.test(item.note)) && reflections.some(item => /math concepts/.test(item.note)));
  const timed = blocks.filter(block => block.actual_start_time !== null);
  assert.ok(timed.some(block => Date.parse(block.actual_end_time) - Date.parse(block.actual_start_time) > Date.parse(block.end_time) - Date.parse(block.start_time)));
  assert.ok(timed.some(block => Date.parse(block.actual_end_time) - Date.parse(block.actual_start_time) < Date.parse(block.end_time) - Date.parse(block.start_time)));
  for (const block of timed) {
    const elapsed = Date.parse(block.actual_end_time) - Date.parse(block.actual_start_time);
    assert.equal(block.actual_study_seconds, Math.floor((elapsed - block.break_time_ms) / 1000));
    assert.ok(Date.parse(block.actual_end_time) <= Date.parse('2026-05-31T12:00:00'));
  }
  const feed = await s.getJournalFeedForUser('owner');
  assert.equal(feed.length, counts.reflectionItems + counts.journalEntries);
  assert.equal(new Set(feed.map(item => item.id)).size, feed.length);
  assert.ok(feed.every((item, index) => !index || Date.parse(item.created_at) <= Date.parse(feed[index - 1].created_at)));
});

test('reflection migration rolls back old topics and schema on failure, then retries without losing IDs', async t => {
  const filename = path.join(os.tmpdir(), `yotei-reflection-migration-${randomUUID()}.db`);
  const instances = [];
  t.after(async () => { for (const instance of instances) await instance.close(); for (const suffix of ['', '-wal', '-shm']) fs.rmSync(filename + suffix, { force: true }); });
  const legacy = new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE Subject (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT, UNIQUE(id, user_id));
    CREATE TABLE Task (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, subject_id INTEGER NOT NULL, title TEXT NOT NULL, deadline TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 30, status TEXT DEFAULT 'pending', postpone_count INTEGER DEFAULT 0);
    CREATE TABLE ReviewItem (id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL REFERENCES Subject(id), topic TEXT NOT NULL, last_reviewed_at TEXT, next_review_at TEXT);
    INSERT INTO Subject VALUES (7, 'owner', 'Biology', '#22D3EE');
    INSERT INTO Task (id,user_id,subject_id,title) VALUES (8,'owner',7,'Cells');
    INSERT INTO ReviewItem VALUES (77,7,'Keep this original topic','2026-10-20T12:00:00Z','2026-10-27T12:00:00Z');`);
  legacy.close();
  const failed = await loadServices(filename, false, undefined, 'ALTER TABLE Task ADD COLUMN description'); instances.push(failed);
  await assert.rejects(failed.getDatabase(), /Migration write failed/);
  const inspect = new DatabaseSync(filename);
  assert.equal(inspect.prepare('SELECT topic FROM ReviewItem WHERE id = 77').get().topic, 'Keep this original topic');
  assert.equal(inspect.prepare("SELECT name FROM sqlite_master WHERE name='ReflectionItem'").get(), undefined);
  inspect.close();
  const retry = await loadServices(filename); instances.push(retry);
  const saved = (await retry.getReflectionsForUser('owner'))[0];
  assert.equal(saved.id, 77); assert.equal(saved.note, 'Keep this original topic');
  assert.equal(saved.created_at, '2026-10-20T12:00:00Z'); assert.equal(saved.study_block_id, null);
  assert.deepEqual(await (await retry.getDatabase()).getAllAsync('PRAGMA foreign_key_check'), []);
});

test('material URL conversion preserves websites and encodes device/Windows file paths', async t => {
  const s = await loadServices(); t.after(s.close);
  assert.equal(s.getMaterialUrl('www.example.com/study'), 'https://www.example.com/study');
  assert.equal(s.getMaterialUrl('C:\\Study Notes\\Week #1.pdf'), 'file:///C:/Study%20Notes/Week%20%231.pdf');
  assert.equal(s.getMaterialUrl('/storage/Week 1.pdf'), 'file:///storage/Week%201.pdf');
  assert.equal(s.getMaterialUrl('content://provider/document/1'), 'content://provider/document/1');
  const providerUri = `content://com.android.externalstorage.documents/document/primary%3A${'encoded-path%2F'.repeat(400)}notes.pdf`;
  assert.equal(s.getMaterialUrl(providerUri), providerUri, 'opaque picker references are not normalized or limited like manual paths');
  for (const value of ['content://', 'content:///missing-authority', 'content://bad authority/1']) assert.throws(() => s.getMaterialUrl(value));
  for (const value of ['javascript:alert(1)', '../notes.pdf', 'https://', 'https://example.com\nother']) assert.throws(() => s.getMaterialUrl(value));
});

test('fallback Android material references save unchanged, remain owned and can be edited without a local-copy flag', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const uri = `content://com.android.providers.downloads.documents/document/${'part%2F'.repeat(700)}42`;
  const id = await s.createMaterial('owner', subject.id, { title: 'Picked Notes', location: uri, local_file_path: null });
  const stored = (await s.getMaterialsForUser('owner'))[0];
  assert.equal(stored.url_or_note, uri); assert.equal(stored.local_file_path, null);
  assert.equal(s.getMaterialUrl(stored.url_or_note), uri);
  await s.updateMaterial('owner', id, { title: 'Updated Notes', location: uri, local_file_path: null });
  assert.equal((await s.getMaterialsForUser('owner'))[0].url_or_note, uri);
  assert.equal((await s.getMaterialsForUser('other')).length, 0);
});

test('task descriptions create/edit/clear, preserve omitted values and remain account-scoped', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { title: 'Cells', subject_id: subject.id, description: '  Read pages 4-8\nDraw a cell  ' });
  assert.equal(task.description, 'Read pages 4-8\nDraw a cell');
  await s.updateTask('owner', task.id, { title: 'Cell cycle', subject_id: subject.id });
  assert.equal((await s.getTasksForUser('owner'))[0].description, task.description);
  await assert.rejects(s.updateTask('other', task.id, { title: 'Stolen', subject_id: subject.id, description: 'Wrong' }));
  await assert.rejects(s.updateTask('owner', task.id, { title: 'Cells', subject_id: subject.id, description: 'x'.repeat(4001) }));
  await s.updateTask('owner', task.id, { title: 'Cells', subject_id: subject.id, description: '' });
  assert.equal((await s.getTasksForUser('owner'))[0].description, null);
});

test('reflections validate owned subjects/completed sessions, preserve notes and survive task deletion', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T09:00:00Z'); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const otherSubject = await s.createSubject('other', { name: 'Other' });
  const task = await s.createTask('owner', { title: 'Cells', subject_id: subject.id });
  const block = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z' });
  await assert.rejects(s.createReflectionItem('owner', { subject_id: subject.id, study_block_id: block.id, note: 'Not finished' }));
  await s.startStudyBlock('owner', block.id); await s.finishStudyBlock('owner', block.id, '2026-10-20T09:10:00Z');
  const note = "I learned this.'); DROP TABLE ReflectionItem; --";
  const first = await s.createReflectionItem('owner', { subject_id: subject.id, study_block_id: block.id, note: `  ${note}  ` });
  assert.equal(first.note, note); assert.equal(first.study_block_id, block.id); assert.equal(first.task_title, 'Cells');
  s.setNow('2026-10-21T09:00:00Z');
  const second = await s.createReflectionItem('owner', { subject_id: subject.id, note: 'Follow-up note' });
  assert.deepEqual(plain((await s.getReflectionsForUser('owner')).map(row => row.id)), [second.id, first.id]);
  assert.equal((await s.getReflectionsForUser('other')).length, 0);
  for (const input of [
    { subject_id: otherSubject.id, note: 'Unowned' }, { subject_id: subject.id, note: '' },
    { subject_id: subject.id, note: 'x'.repeat(4001) }, { subject_id: subject.id, study_block_id: -1, note: 'Invalid block' },
  ]) await assert.rejects(s.createReflectionItem('owner', input));
  await assert.rejects(s.createReflectionItem('other', { subject_id: otherSubject.id, study_block_id: block.id, note: 'Unowned session' }));
  await s.deleteTask('owner', task.id);
  const saved = await s.getReflectionsForUser('owner');
  assert.equal(saved.length, 2); assert.equal(saved[1].study_block_id, null); assert.equal(saved[1].note, note);
});

test('a reflection read failure inserts nothing and a retry creates one note', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' }), db = await s.getDatabase();
  const read = db.getFirstAsync; db.getFirstAsync = async () => { throw new Error('Read failed'); };
  await assert.rejects(s.createReflectionItem('owner', { subject_id: subject.id, note: 'Cells' }), /Read failed/);
  db.getFirstAsync = read;
  assert.equal((await s.getReflectionsForUser('owner')).length, 0);
  await s.createReflectionItem('owner', { subject_id: subject.id, note: 'Cells' });
  assert.equal((await s.getReflectionsForUser('owner')).length, 1);
});

test('day details match chart totals, exclude breaks and report scheduled-end overrun with account isolation', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T09:13:00Z'); t.after(s.close);
  const block = await focusFixture(s, 'owner');
  await s.startStudyBlock('owner', block.id);
  await s.pauseStudyBlock('owner', block.id, '2026-10-20T09:18:00Z');
  await s.resumeStudyBlock('owner', block.id, '2026-10-20T09:20:00Z');
  const done = await s.finishStudyBlock('owner', block.id, '2026-10-20T09:40:00Z');
  const date = s.getLocalDateKey(new Date(done.actual_end_time));
  const details = await s.getStudyDayDetails('owner', date);
  assert.equal(details.length, 1); assert.equal(details[0].studied_minutes, 25);
  assert.equal(details[0].planned_minutes, 30); assert.equal(details[0].break_minutes, 2);
  assert.equal(details[0].elapsed_minutes, 27); assert.equal(details[0].overrun_minutes, 0); assert.equal(details[0].finished_late_minutes, 10);
  assert.equal((await s.getWeeklyStudyMinutes('owner', date))[6].minutes, details[0].studied_minutes);
  assert.equal((await s.getStudyDayDetails('other', date)).length, 0);
  assert.equal((await s.getStudyDayDetails('owner', '2026-10-19')).length, 0);
  await assert.rejects(s.getStudyDayDetails('owner', '2026-02-30'));
});

test('materials validate links, bind owned CRUD and cascade without touching original files', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const id = await s.createMaterial('owner', subject.id, { title: "Notes'); DROP TABLE Material; --", location: ' https://example.com/notes ' });
  assert.equal((await s.getMaterialsForUser('owner'))[0].url_or_note, 'https://example.com/notes');
  assert.equal((await s.getMaterialsForUser('other')).length, 0);
  await assert.rejects(s.createMaterial('other', subject.id, { title: 'Bad', location: 'https://example.com' }));
  await assert.rejects(s.updateMaterial('other', id, { title: 'Bad', location: 'https://example.com' }));
  await assert.rejects(s.deleteMaterial('other', id));
  for (const location of ['javascript:alert(1)', 'notes.pdf', '', 'ftp://example.com']) await assert.rejects(s.createMaterial('owner', subject.id, { title: 'Bad', location }));
  await s.updateMaterial('owner', id, { title: 'Lecture Notes', location: 'C:\\Study\\Week 1.pdf' });
  assert.equal((await s.getMaterialsForUser('owner'))[0].title, 'Lecture Notes');
  await s.deleteMaterial('owner', id); assert.equal((await s.getMaterialsForUser('owner')).length, 0);
  await s.createMaterial('owner', subject.id, { title: 'Local Notes', location: '/storage/notes.pdf' });
  await s.deleteSubject('owner', subject.id); assert.equal((await s.getMaterialsForUser('owner')).length, 0);
});

test('weekly progress fills seven local calendar dates across year/leap boundaries and validates input', async t => {
  const s = await loadServices(); t.after(s.close);
  assert.deepEqual(plain(await s.getWeeklyStudyMinutes('empty-account', '2027-01-03')), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ].map(date => ({ date, minutes: 0 })));
  const leap = await s.getWeeklyStudyMinutes('empty-account', '2028-03-02');
  assert.equal(leap[4].date, '2028-02-29');
  await assert.rejects(s.getWeeklyStudyMinutes(' ', '2026-10-20'), /Sign in/i);
  await assert.rejects(s.getWeeklyStudyMinutes('student', '2026-02-30'), /valid calendar date/i);
});

test('weekly progress isolates accounts, uses actual work including zero, and credits the local completion day', async t => {
  const s = await loadServices(); t.after(s.close);
  const db = await s.getDatabase();
  const subject = await s.createSubject('student', { name: 'Biology' });
  const task = await s.createTask('student', { subject_id: subject.id, title: 'Cells' });
  const otherSubject = await s.createSubject('other', { name: 'History' });
  const otherTask = await s.createTask('other', { subject_id: otherSubject.id, title: 'Essay' });
  async function insert(start, end, { status = 'done', actualStart = null, actualEnd = null, seconds = 0, taskId = task.id } = {}) {
    await db.runAsync(`INSERT INTO StudyBlock (task_id, start_time, end_time, status, actual_start_time, actual_end_time, actual_study_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, taskId, new Date(start).toISOString(), new Date(end).toISOString(), status,
    actualStart && new Date(actualStart).toISOString(), actualEnd && new Date(actualEnd).toISOString(), seconds);
  }
  // Completion is exactly the inclusive first midnight; all 30 minutes belong to that day.
  await insert('2026-10-13T23:30:00', '2026-10-14T00:00:00');
  await insert('2026-10-13T22:00:00', '2026-10-13T23:00:00'); // outside the week
  await insert('2026-10-20T23:30:00', '2026-10-21T00:00:00'); // exclusive end boundary
  await insert('2026-10-15T10:00:00', '2026-10-15T10:45:00'); // legacy untimed completion
  await insert('2026-10-15T12:00:00', '2026-10-15T13:00:00', {
    actualStart: '2026-10-15T12:00:00', actualEnd: '2026-10-15T12:25:30', seconds: 1230,
  }); // actual 20.5 minutes, not the planned hour
  await insert('2026-10-15T14:00:00', '2026-10-15T15:00:00', {
    actualStart: '2026-10-15T14:00:00', actualEnd: '2026-10-15T14:05:00', seconds: 0,
  }); // all-break session must stay zero
  await insert('2026-10-16T23:00:00', '2026-10-17T00:00:00', {
    actualStart: '2026-10-16T23:00:00', actualEnd: '2026-10-18T00:00:00', seconds: 600,
  }); // completion date, not the original planned date
  for (const status of ['scheduled', 'active', 'missed']) {
    await insert('2026-10-19T10:00:00', '2026-10-19T11:00:00', { status });
  }
  await insert('2026-10-19T12:00:00', '2026-10-19T13:00:00', { taskId: otherTask.id });
  const progress = await s.getWeeklyStudyMinutes('student', '2026-10-20');
  assert.deepEqual(plain(progress.map(day => day.minutes)), [30, 65.5, 0, 0, 10, 0, 0]);
  assert.deepEqual(plain((await s.getWeeklyStudyMinutes('other', '2026-10-20')).map(day => day.minutes)), [0, 0, 0, 0, 0, 60, 0]);
});

test('weekly calendar aggregation preserves elapsed minutes through local daylight-saving changes', async t => {
  const s = await loadServices(); t.after(s.close);
  const db = await s.getDatabase();
  const subject = await s.createSubject('student', { name: 'Biology' });
  const task = await s.createTask('student', { subject_id: subject.id, title: 'Cells' });
  for (const date of ['2026-03-08', '2026-11-01']) {
    const start = new Date(`${date}T01:30:00`);
    const end = new Date(`${date}T03:30:00`);
    await db.runAsync("INSERT INTO StudyBlock (task_id, start_time, end_time, status) VALUES (?, ?, ?, 'done')", task.id, start.toISOString(), end.toISOString());
    const result = await s.getWeeklyStudyMinutes('student', date);
    assert.equal(result[6].minutes, (end.getTime() - start.getTime()) / 60000);
    assert.equal(result.length, 7);
  }
});

async function focusFixture(s, user = 'student', start = '2026-10-20T09:00:00Z', end = '2026-10-20T09:30:00Z') {
  const subject = await s.createSubject(user, { name: 'Biology' });
  const task = await s.createTask(user, { subject_id: subject.id, title: 'Cell cycle' });
  return s.createStudyBlock(user, { task_id: task.id, start_time: start, end_time: end });
}

test('focus timer tracks lateness, freezes work on breaks, survives scheduled end, and finishes once', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T09:13:00Z');
  t.after(s.close);
  const block = await focusFixture(s);
  const active = await s.startStudyBlock('student', block.id);
  assert.equal(active.status, 'active');
  assert.equal((await s.getWeeklyStudyMinutes('student', '2026-10-20')).reduce((sum, day) => sum + day.minutes, 0), 0, 'unfinished work is not completed progress');
  assert.equal(active.actual_start_time, '2026-10-20T09:13:00.000Z');
  assert.equal(s.getCompletionStartMessage(active), 'Session complete! You started 13 minutes late.');
  assert.equal(await s.getDailyStudyMinutes('student', s.getLocalDateKey(new Date(block.start_time))), 30, 'active sessions retain their planned workload');
  const paused = await s.pauseStudyBlock('student', block.id, '2026-10-20T09:18:00Z');
  assert.equal(s.getFocusTiming(paused, Date.parse('2026-10-20T09:24:00Z')).workSeconds, 300);
  assert.equal(s.getFocusTiming(paused, Date.parse('2026-10-20T09:24:00Z')).currentBreakSeconds, 360);
  const resumed = await s.resumeStudyBlock('student', block.id, '2026-10-20T09:20:00Z');
  assert.equal(resumed.break_time_ms, 120000); assert.equal(resumed.break_time_minutes, 2);
  await s.markExpiredStudyBlocks('student', '2026-10-20T10:00:00Z');
  assert.equal((await s.getStudyBlocksForUser('student'))[0].status, 'active');
  assert.equal((await s.getStudyBlocksForUser('student', { date: '2026-10-28' }))[0].id, block.id, 'unfinished timers remain reachable on a later date');
  const finished = await s.finishStudyBlock('student', block.id, '2026-10-20T09:40:00Z');
  assert.equal(finished.status, 'done'); assert.equal(finished.actual_study_seconds, 25 * 60);
  assert.equal(finished.actual_end_time, '2026-10-20T09:40:00.000Z');
  const progress = await s.getWeeklyStudyMinutes('student', s.getLocalDateKey(new Date(finished.actual_end_time)));
  assert.equal(progress[6].minutes, 25, 'weekly progress uses actual work and excludes the two-minute break');
  const retry = await s.finishStudyBlock('student', block.id, '2026-10-20T10:00:00Z');
  assert.deepEqual(plain(retry), plain(finished));
  assert.equal(s.getFocusTiming(finished, Date.parse('2026-10-21T10:00:00Z')).workSeconds, 1500);
  assert.equal(s.formatElapsed(754), '12:34'); assert.equal(s.formatElapsed(3754), '1:02:34');
});

test('short repeated breaks retain millisecond precision and finishing during a break excludes all break time', async t => {
  const s = await loadServices(); t.after(s.close);
  const block = await focusFixture(s);
  await s.startStudyBlock('student', block.id, '2026-10-20T09:00:00Z');
  await s.pauseStudyBlock('student', block.id, '2026-10-20T09:00:00.200Z');
  await s.resumeStudyBlock('student', block.id, '2026-10-20T09:00:00.800Z');
  await s.pauseStudyBlock('student', block.id, '2026-10-20T09:00:01Z');
  const done = await s.finishStudyBlock('student', block.id, '2026-10-20T09:01:02Z');
  assert.equal(done.break_time_ms, 61600); assert.equal(done.break_time_minutes, 1);
  assert.equal(done.actual_study_seconds, 0, 'only 400 ms of actual work, floored once at finish');
  assert.equal(done.break_started_at, null);
});

test('timer retries never reset timestamps or double-count a break and only one session runs per user', async t => {
  const s = await loadServices(); t.after(s.close);
  const a = await focusFixture(s); const b = await focusFixture(s); const other = await focusFixture(s, 'other');
  const results = await Promise.allSettled([s.startStudyBlock('student', a.id, '2026-10-20T09:00:00Z'), s.startStudyBlock('student', b.id, '2026-10-20T09:00:00Z')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await s.startStudyBlock('student', a.id, '2026-10-20T09:01:00Z')).actual_start_time, '2026-10-20T09:00:00.000Z');
  await s.startStudyBlock('other', other.id, '2026-10-20T09:00:00Z');
  await s.pauseStudyBlock('student', a.id, '2026-10-20T09:05:00Z');
  const repeatedPause = await s.pauseStudyBlock('student', a.id, '2026-10-20T09:06:00Z');
  assert.equal(repeatedPause.break_started_at, '2026-10-20T09:05:00.000Z');
  await s.resumeStudyBlock('student', a.id, '2026-10-20T09:07:00Z');
  const repeatedResume = await s.resumeStudyBlock('student', a.id, '2026-10-20T09:08:00Z');
  assert.equal(repeatedResume.break_time_ms, 120000);
  await s.finishStudyBlock('student', a.id, '2026-10-20T09:10:00Z');
  assert.equal((await s.startStudyBlock('student', b.id, '2026-10-20T09:11:00Z')).status, 'active');
});

test('timer ownership, invalid transitions and transaction failures preserve stored state', async t => {
  const s = await loadServices(); t.after(s.close);
  const block = await focusFixture(s);
  for (const service of [s.startStudyBlock, s.pauseStudyBlock, s.resumeStudyBlock, s.finishStudyBlock]) {
    for (const [user, id, now] of [['', block.id, '2026-10-20T09:00:00Z'], ['other', block.id, '2026-10-20T09:00:00Z'], ['student', -1, '2026-10-20T09:00:00Z'], ['student', 9999, '2026-10-20T09:00:00Z'], ['student', block.id, 'invalid']]) {
      await assert.rejects(service(user, id, now));
    }
  }
  for (const now of ['2026-10-20T08:59:59Z', '2026-10-20T09:30:00Z']) await assert.rejects(s.startStudyBlock('student', block.id, now), /scheduled time/);
  await assert.rejects(s.pauseStudyBlock('student', block.id, '2026-10-20T09:00:00Z'), /Start this session/);
  const active = await s.startStudyBlock('student', block.id, '2026-10-20T09:00:00Z');
  await assert.rejects(s.pauseStudyBlock('student', block.id, '2026-10-20T08:59:59Z'), /clock/);
  const db = await s.getDatabase();
  await db.execAsync("CREATE TRIGGER reject_timer_update BEFORE UPDATE ON StudyBlock BEGIN SELECT RAISE(ABORT, 'Injected timer failure'); END");
  await assert.rejects(s.pauseStudyBlock('student', block.id, '2026-10-20T09:01:00Z'), /Injected timer failure/);
  assert.deepEqual(plain((await s.getStudyBlocksForUser('student'))[0]), plain(active));
  await db.execAsync('DROP TRIGGER reject_timer_update');
  await s.finishStudyBlock('student', block.id, '2026-10-20T09:10:00Z');
  await assert.rejects(s.resumeStudyBlock('student', block.id, '2026-10-20T09:11:00Z'), /Start this session/);
});

test('active and paused timers survive closing SQLite and reopening without losing or running paused work', async t => {
  const filename = path.join(os.tmpdir(), `yotei-timer-${randomUUID()}.db`);
  const instances = [];
  t.after(async () => { for (const s of instances) await s.close(); for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix); });
  const first = await loadServices(filename); instances.push(first);
  const block = await focusFixture(first);
  await first.startStudyBlock('student', block.id, '2026-10-20T09:00:00Z');
  await first.close();
  const second = await loadServices(filename); instances.push(second);
  const active = (await second.getStudyBlocksForUser('student'))[0];
  assert.equal(second.getFocusTiming(active, Date.parse('2026-10-20T09:05:00Z')).workSeconds, 300);
  await second.pauseStudyBlock('student', block.id, '2026-10-20T09:05:00Z'); await second.close();
  const third = await loadServices(filename); instances.push(third);
  const paused = (await third.getStudyBlocksForUser('student'))[0];
  assert.equal(third.getFocusTiming(paused, Date.parse('2026-10-21T09:05:00Z')).workSeconds, 300);
  assert.equal(third.getFocusTiming(paused, Date.parse('2026-10-21T09:05:00Z')).breakSeconds, 86400);
  await third.resumeStudyBlock('student', block.id, '2026-10-21T09:05:00Z');
  const done = await third.finishStudyBlock('student', block.id, '2026-10-21T09:10:00Z');
  assert.equal(done.actual_study_seconds, 600); assert.equal(done.break_time_minutes, 1440);
});

test('study completion feeds review topics and repeated missed sessions increment task coaching counts once each', async t => {
  const services = await loadServices(':memory:', false, '2026-10-20T09:00:00Z');
  t.after(services.close);
  const subject = await services.createSubject('student', { name: 'Biology' });
  const task = await services.createTask('student', { subject_id: subject.id, title: 'Study the cell cycle' });
  const block = await services.createStudyBlock('student', {
    task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z',
  });
  assert.equal(block.subject_id, subject.id);
  services.setNow('2026-10-20T09:13:00Z');
  await services.startStudyBlock('student', block.id);
  services.setNow('2026-10-20T09:18:00Z');
  await services.pauseStudyBlock('student', block.id);
  services.setNow('2026-10-20T09:20:00Z');
  await services.resumeStudyBlock('student', block.id);
  services.setNow('2026-10-20T09:25:00Z');
  const completed = await services.finishStudyBlock('student', block.id);
  assert.equal(completed.actual_study_seconds, 600);
  assert.equal(completed.break_time_minutes, 2);
  assert.equal(completed.subject_id, subject.id);
  assert.equal(completed.task_title, task.title);
  const review = await services.createReflectionItem('student', {
    subject_id: completed.subject_id, study_block_id: completed.id, note: 'The checkpoints between cell-cycle phases',
  });
  assert.equal(review.subject_id, subject.id);
  assert.deepEqual((await services.getReflectionsForUser('student')).map(item => item.id), [review.id]);

  const original = await services.createStudyBlock('student', {
    task_id: task.id, start_time: '2026-10-20T09:30:00Z', end_time: '2026-10-20T10:00:00Z',
  });
  const otherSubject = await services.createSubject('other-student', { name: 'Biology' });
  const otherTask = await services.createTask('other-student', { subject_id: otherSubject.id, title: 'Genetics' });
  const otherBlock = await services.createStudyBlock('other-student', {
    task_id: otherTask.id, start_time: original.start_time, end_time: original.end_time,
  });
  services.setNow('2026-10-20T10:01:00Z');
  assert.equal((await services.markExpiredStudyBlocks('student')).changes, 1);
  const missed = (await services.getStudyBlocksForUser('student')).find(item => item.id === original.id);
  assert.equal(missed.status, 'missed');
  assert.equal((await services.getTasksForUser('student'))[0].postpone_count, 0, 'a miss alone does not count as a reschedule');
  const [firstReplacement, retry] = await Promise.all([
    services.rescheduleStudyBlock('student', original.id),
    services.rescheduleStudyBlock('student', original.id),
  ]);
  assert.equal(firstReplacement.id, retry.id);
  assert.equal(firstReplacement.rescheduled_from, original.id);
  assert.equal(firstReplacement.subject_id, subject.id);
  assert.equal(firstReplacement.start_time, '2026-10-20T11:01:00.000Z');
  assert.equal((await services.getTasksForUser('student'))[0].postpone_count, 1);

  services.setNow('2026-10-20T11:32:00Z');
  assert.equal((await services.markExpiredStudyBlocks('student')).changes, 1);
  const secondReplacement = await services.rescheduleStudyBlock('student', firstReplacement.id);
  assert.equal(secondReplacement.rescheduled_from, firstReplacement.id);
  assert.equal(secondReplacement.start_time, '2026-10-20T12:32:00.000Z');
  assert.equal((await services.getTasksForUser('student'))[0].postpone_count, 2, 'two recommitments enable task coaching');
  await services.rescheduleStudyBlock('student', firstReplacement.id);
  assert.equal((await services.getTasksForUser('student'))[0].postpone_count, 2, 'retrying a replacement never increments again');
  const history = await services.getStudyBlocksForUser('student');
  assert.equal(history.find(item => item.id === block.id).status, 'done');
  assert.equal(history.find(item => item.id === original.id).rescheduled_to, firstReplacement.id);
  assert.equal(history.find(item => item.id === firstReplacement.id).rescheduled_to, secondReplacement.id);
  assert.equal(history.find(item => item.id === secondReplacement.id).status, 'scheduled');
  assert.equal((await services.getStudyBlocksForUser('other-student'))[0].id, otherBlock.id);
  assert.equal((await services.getStudyBlocksForUser('other-student'))[0].status, 'scheduled');
  assert.equal((await services.getTasksForUser('other-student'))[0].postpone_count, 0);
  assert.equal((await services.getReflectionsForUser('other-student')).length, 0);
  assert.equal((await services.getReflectionsForUser('student')).length, 1, 'reflections remain in the chronological log');
});

test('demo reset replaces only the selected account and can be repeated', async t => {
  const services = await loadServices(':memory:', false, '2026-10-20T12:00:00');
  t.after(services.close);
  const database = await services.getDatabase();
  const snapshots = {};
  for (const user of ['demo-user', 'other-user']) {
    const subject = await services.createSubject(user, { name: 'Old subject' });
    const task = await services.createTask(user, { subject_id: subject.id, title: 'Old task' });
    await services.createStudyBlock(user, {
      task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z',
    });
    await database.runAsync("INSERT INTO ReflectionItem (subject_id, note, created_at) VALUES (?, ?, '2026-10-20T12:00:00Z')", subject.id, 'Old review');
    await database.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.id, task.id, 'Old notes');
    snapshots[user] = { subject, task: (await services.getTasksForUser(user))[0], blocks: plain(await services.getStudyBlocksForUser(user)) };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const counts = await services.seedDemoData('demo-user');
    assert.equal(counts.historyDays, 183); assert.equal(counts.tasks, 40); assert.equal(counts.totalMinutes, 240);
    assert.ok(counts.studyBlocks >= 280 && counts.reflectionItems > 150 && counts.journalEntries >= 90);
    const subjects = await services.getSubjectsForUser('demo-user');
    const tasks = await services.getTasksForUser('demo-user');
    assert.equal(subjects.length, 20);
    assert.equal(new Set(subjects.map(subject => subject.field_of_study)).size, 5);
    assert.equal(tasks.length, 40);
    assert.equal(tasks.filter(task => task.postpone_count >= 2).length, 2);
    assert.ok(tasks.every(task => Boolean(task.description)));
    assert.equal(tasks.filter(task => task.deadline === '2026-10-20').length, 2);
    assert.equal(tasks.filter(task => task.deadline === '2026-10-21').length, 3);
    assert.equal(tasks.filter(task => task.deadline === '2026-10-19').length, 1);
    assert.equal((await services.getStudyBlocksForUser('demo-user')).length, counts.studyBlocks);
    const history = await services.getWeeklyStudyMinutes('demo-user', '2026-10-20');
    assert.ok(history.slice(0, 6).every(day => day.minutes > 0));
    const reviews = await services.getReflectionsForUser('demo-user');
    assert.equal(reviews.length, counts.reflectionItems);
    assert.equal(new Set(reviews.map(review => review.subject_name)).size, 20);
    assert.ok(reviews.every(review => Number.isFinite(Date.parse(review.created_at))));
    assert.ok(reviews.every(review => review.note !== 'Old review'));
    assert.deepEqual(plain(await services.getSubjectsForUser('other-user')), [plain(snapshots['other-user'].subject)]);
    assert.deepEqual(plain(await services.getTasksForUser('other-user')), [plain(snapshots['other-user'].task)]);
    assert.deepEqual(plain(await services.getStudyBlocksForUser('other-user')), snapshots['other-user'].blocks);
    for (const table of ['ReflectionItem', 'Material']) {
      const rows = await database.getAllAsync(`SELECT item.* FROM ${table} AS item INNER JOIN Subject AS subject ON subject.id = item.subject_id WHERE subject.user_id = ?`, 'other-user');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].subject_id, snapshots['other-user'].subject.id);
      if (table === 'ReflectionItem') assert.equal(rows[0].note, 'Old review');
    }
    assert.equal((await database.getAllAsync('SELECT * FROM Material')).length, 41);
    assert.equal((await database.getAllAsync('SELECT * FROM ReflectionItem')).length, counts.reflectionItems + 1);
  }
  await assert.rejects(services.seedDemoData(' '), /Sign in/i);
});

test('demo data rolls back completely if an insert fails after the reset', async t => {
  const services = await loadServices();
  t.after(services.close);
  await services.seedDemoData('demo-user');
  const database = await services.getDatabase();
  const before = {};
  const tables = ['Subject', 'Task', 'StudyBlock', 'ReflectionItem', 'Material', 'JournalEntry'];
  for (const table of tables) before[table] = await database.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  const prepare = database.prepareAsync;
  database.prepareAsync = async sql => {
    if (sql.includes('INSERT INTO Task')) throw new Error('Simulated disk error');
    return prepare(sql);
  };
  await assert.rejects(services.seedDemoData('demo-user'), /Simulated disk error/);
  database.prepareAsync = prepare;
  for (const table of tables) assert.deepEqual(await database.getAllAsync(`SELECT * FROM ${table} ORDER BY id`), before[table]);
});

test('demo sessions stay at 240 minutes and trigger the guardrail at all times of day', async t => {
  for (const localNow of [
    '2026-10-20T00:01:00', '2026-10-20T12:00:00', '2026-10-20T23:59:00',
    '2026-03-08T00:01:00', '2026-03-08T23:59:00',
    '2026-11-01T00:01:00', '2026-11-01T23:59:00',
  ]) {
    await t.test(localNow, async t => {
      const services = await loadServices(':memory:', false, localNow);
      t.after(services.close);
      const counts = await services.seedDemoData('demo-user');
      const today = services.getLocalDateKey(new Date(localNow));
      const { start, end } = services.getLocalDayRange(today);
      const blocks = await services.getStudyBlocksForUser('demo-user', { date: today });
      assert.equal(blocks.length, 4);
      const progress = await services.getWeeklyStudyMinutes('demo-user', today);
      assert.ok(progress.slice(0, 6).every(day => day.minutes > 0));
      const details = await services.getStudyDayDetails('demo-user', today);
      assert.ok(Math.abs(progress[6].minutes - details.reduce((sum, row) => sum + row.studied_minutes, 0)) < 0.001);
      assert.equal(blocks.reduce((sum, block) => sum + (Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000, 0), 240);
      for (const block of blocks) {
        assert.ok(Date.parse(block.start_time) >= Date.parse(start));
        assert.ok(Date.parse(block.end_time) <= Date.parse(end));
        if (Date.parse(block.end_time) <= Date.parse(localNow)) assert.equal(block.status, 'done');
      }
      await services.markExpiredStudyBlocks('demo-user', new Date(localNow).toISOString());
      assert.equal(await services.getDailyStudyMinutes('demo-user', today), 240);
      const input = {
        task_id: blocks[0].task_id,
        start_time: new Date(localNow).toISOString(),
        end_time: new Date(Date.parse(localNow) + 5 * 60000).toISOString(),
      };
      await assert.rejects(services.createStudyBlock('demo-user', input), error => {
        assert.equal(error.name, 'StudyLoadWarning');
        assert.equal(error.days[0].current_minutes, 240);
        assert.ok(error.days[0].total_minutes > 240);
        return true;
      });
      assert.equal((await services.getStudyBlocksForUser('demo-user')).length, counts.studyBlocks, 'warning inserts no data');
      const confirmed = await services.createStudyBlock('demo-user', input, { allowHeavyDay: true });
      assert.equal(confirmed.status, 'scheduled');
    });
  }
});

test('initializes all six tables and shares one ready connection', async t => {
  const services = await loadServices();
  t.after(services.close);
  const [first, second] = await Promise.all([services.getDatabase(), services.getDatabase()]);
  assert.equal(first, second);
  assert.equal(services.opens, 1);
  const tables = await first.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  assert.deepEqual(tables.map(row => row.name), ['JournalEntry', 'Material', 'ReflectionItem', 'StudyBlock', 'Subject', 'Task']);
  assert.equal((await first.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
});

test('isolates accounts and rejects tasks linked to another user’s subject', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subjectA = await services.createSubject('user-a', { name: ' Mathematics ' });
  const subjectB = await services.createSubject('user-b', { name: 'Biology' });
  const taskA = await services.createTask('user-a', { title: ' Read chapter 1 ', subject_id: subjectA.id });
  await services.createTask('user-b', { title: 'Make flashcards', subject_id: subjectB.id });
  assert.deepEqual(plain(await services.getSubjectsForUser('user-a')), [plain(subjectA)]);
  assert.deepEqual(plain(await services.getTasksForUser('user-a')), [plain(taskA)]);
  assert.equal(taskA.title, 'Read chapter 1');
  assert.equal(taskA.subject_name, 'Mathematics');
  assert.equal(taskA.estimated_minutes, 30);
  assert.equal(taskA.status, 'pending');
  assert.equal(taskA.postpone_count, 0);
  assert.equal(taskA.deadline, null);
  await assert.rejects(services.createTask('user-a', { title: 'Wrong owner', subject_id: subjectB.id }), /belonging to your account/);
  const database = await services.getDatabase();
  await assert.rejects(database.runAsync('INSERT INTO Task (user_id, subject_id, title) VALUES (?, ?, ?)', 'user-a', subjectB.id, 'Bypass attempt'), /FOREIGN KEY/);
  assert.equal((await services.getTasksForUser('user-a')).length, 1);
  assert.equal((await services.getTasksForUser('user-b')).length, 1);
});

test('subject fields normalize, persist, and supply the first gradient color across linked services', async t => {
  const s = await loadServices();
  t.after(s.close);
  const subject = await s.createSubject('user', { name: ' Biochemistry ', field_of_study: ' Biology , Chemistry ', field_colors: ' #2dd4bf , #60a5fa ' });
  assert.equal(subject.name, 'Biochemistry');
  assert.equal(subject.field_of_study, 'Biology, Chemistry');
  assert.equal(subject.field_colors, '#2DD4BF,#60A5FA');
  assert.deepEqual(plain(await s.getSubjectsForUser('user')), [plain(subject)]);
  assert.equal((await s.getSubjectsForUser('other')).length, 0);
  const task = await s.createTask('user', { subject_id: subject.id, title: 'Enzymes' });
  assert.equal(task.subject_color, '#2DD4BF');
  assert.equal((await s.getTasksForUser('user'))[0].subject_color, '#2DD4BF');
  const review = await s.createReflectionItem('user', { subject_id: subject.id, note: 'Catalysis' });
  assert.equal(review.subject_color, '#2DD4BF');
  assert.equal((await s.getReflectionsForUser('user'))[0].subject_color, '#2DD4BF');
  const block = await s.createStudyBlock('user', { task_id: task.id, start_time: '2026-11-01T10:00:00Z', end_time: '2026-11-01T10:30:00Z' });
  assert.equal(block.subject_color, '#2DD4BF');
  assert.equal((await s.getStudyBlocksForUser('user'))[0].subject_color, '#2DD4BF');
  assert.deepEqual(plain(s.fieldGradient(subject.field_colors)), ['#2DD4BF', '#60A5FA']);
  const single = plain(s.fieldGradient('#123456'));
  assert.equal(single[0], '#123456');
  assert.notEqual(single[1], single[0]);
  assert.match(single[1], /^#[0-9A-F]{6}$/);
});

test('subject codes normalize, persist, edit safely and retain their value for older update callers', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Software Engineering', subject_code: ' se-101 ' });
  assert.equal(subject.subject_code, 'SE-101');
  const input = { name: subject.name, field_of_study: subject.field_of_study, field_colors: subject.field_colors };
  let updated = await s.updateSubject('owner', subject.id, { ...input, subject_code: ' se-201 ' });
  assert.equal(updated.subject_code, 'SE-201');
  updated = await s.updateSubject('owner', subject.id, input);
  assert.equal(updated.subject_code, 'SE-201');
  assert.equal((await s.getSubjectsForUser('owner'))[0].subject_code, 'SE-201');
  for (const subject_code of ['', ' ', null, 123, 'a'.repeat(33), 'ABC\nDEF', 'DROP; TABLE']) {
    await assert.rejects(s.createSubject('owner', { name: 'Invalid', subject_code }));
    await assert.rejects(s.updateSubject('owner', subject.id, { ...input, subject_code }));
  }
  await assert.rejects(s.updateSubject('other', subject.id, { ...input, subject_code: 'TAKEN' }));
  assert.equal((await s.getSubjectsForUser('owner'))[0].subject_code, 'SE-201');
  assert.equal((await s.createSubject('owner', { name: 'Default' })).subject_code, 'GEN-101');
});

test('typed durations accept hours/minutes, reject invalid drafts and preserve elapsed time across dates and DST', async t => {
  const s = await loadServices(); t.after(s.close);
  for (const [input, minutes] of [['4h 30m', 270], ['45m', 45], ['2h', 120], [' 2H 15M ', 135], ['4h30m', 270], ['45', 45], ['0h 5m', 5]]) {
    assert.equal(s.parseStudyDuration(input), minutes);
  }
  for (const invalid of ['', ' ', '-5', '-5m', '1.5h', '0m', '0h', 'abc', '2h -1m', '1h 2h', '5m 1h', 'Infinity', '999999999999999999h']) {
    assert.throws(() => s.parseStudyDuration(invalid), /positive duration/);
  }
  for (const start of ['2026-10-20T23:30:00+08:00', '2026-03-08T01:30:00-05:00', '2026-11-01T01:30:00-04:00']) {
    const window = { start: new Date(start), end: new Date(Date.parse(start) + 60000) };
    const originalEnd = window.end.getTime();
    const updated = s.applyStudyDuration(window, '2h');
    assert.equal(updated.end.getTime() - updated.start.getTime(), 120 * 60000);
    assert.equal(window.end.getTime(), originalEnd);
  }
  assert.throws(() => s.applyStudyDuration({ start: new Date('invalid') }, '2h'), /valid start/);
  assert.throws(() => s.applyStudyDuration({ start: new Date('2026-10-20') }, '150119987000m'), /too long/);
});

test('a typed 4h 30m session triggers the SQLite workload warning and saves only after override', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Math', subject_code: 'MATH-2' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Revision' });
  const window = s.applyStudyDuration({ start: new Date('2026-11-05T09:00:00Z') }, '4h 30m');
  const times = s.buildStudyTimes(window, new Date('2026-11-01T08:00:00Z'));
  await assert.rejects(s.createStudyBlock('owner', { task_id: task.id, ...times }), error => error.name === 'StudyLoadWarning');
  assert.equal((await s.getStudyBlocksForUser('owner')).length, 0);
  const block = await s.createStudyBlock('owner', { task_id: task.id, ...times }, { allowHeavyDay: true });
  assert.equal((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000, 270);
});

test('editing a subject preserves its ID and linked records while refreshing joined names and colors', async t => {
  const s = await loadServices();
  t.after(s.close);
  const subject = await s.createSubject('user', { name: 'Biology' });
  const task = await s.createTask('user', { subject_id: subject.id, title: 'Study enzymes' });
  const review = await s.createReflectionItem('user', { subject_id: subject.id, note: 'Catalysis' });
  const block = await s.createStudyBlock('user', { task_id: task.id, start_time: '2026-11-01T10:00:00Z', end_time: '2026-11-01T10:30:00Z' });
  const db = await s.getDatabase();
  await db.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.id, task.id, 'Class notes');
  const updated = await s.updateSubject('user', subject.id, { name: "  Biochemistry O'Brien  ", field_of_study: ' Biology , Chemistry ', field_colors: ' #123abc, #def456 ' });
  assert.equal(updated.id, subject.id);
  assert.equal(updated.name, "Biochemistry O'Brien");
  assert.equal(updated.field_of_study, 'Biology, Chemistry');
  assert.equal(updated.field_colors, '#123ABC,#DEF456');
  assert.deepEqual(plain(await s.getSubjectsForUser('user')), [plain(updated)]);
  assert.equal((await s.getTasksForUser('user'))[0].id, task.id);
  assert.equal((await s.getTasksForUser('user'))[0].subject_name, updated.name);
  assert.equal((await s.getTasksForUser('user'))[0].subject_color, '#123ABC');
  assert.equal((await s.getReflectionsForUser('user'))[0].id, review.id);
  assert.equal((await s.getReflectionsForUser('user'))[0].subject_name, updated.name);
  assert.equal((await s.getStudyBlocksForUser('user'))[0].id, block.id);
  assert.equal((await s.getStudyBlocksForUser('user'))[0].subject_color, '#123ABC');
  assert.equal((await db.getFirstAsync('SELECT subject_id FROM Material WHERE task_id = ?', task.id)).subject_id, subject.id);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
  await s.updateSubject('user', subject.id, updated);
  assert.equal((await s.getSubjectsForUser('user')).length, 1, 'saving unchanged values does not duplicate a subject');
});

test('subject edits reject invalid IDs, metadata, and other accounts without changing stored records', async t => {
  const s = await loadServices();
  t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Keep me' });
  const input = { name: "Art'); DROP TABLE Subject; --", field_of_study: 'Arts', field_colors: '#ABCDEF' };
  for (const action of [
    () => s.updateSubject('', subject.id, input),
    () => s.updateSubject('other-user', subject.id, input),
    () => s.updateSubject('owner', 99999, input),
    ...[0, -1, 1.5, '1'].map(id => () => s.updateSubject('owner', id, input)),
    ...[{ name: ' ' }, { name: 'x'.repeat(129) }, { field_of_study: ', ' }, { field_of_study: null }, { field_colors: '#nope' }, { field_colors: '#ABCDEF,#abcdef' }, { field_colors: '#ABCDEF,#123456,#654321' }].map(change => () => s.updateSubject('owner', subject.id, { ...input, ...change })),
  ]) {
    await assert.rejects(action);
    assert.deepEqual(plain(await s.getSubjectsForUser('owner')), [plain(subject)]);
  }
  const updated = await s.updateSubject('owner', subject.id, input);
  assert.equal(updated.name, input.name, 'SQL-like text is bound as data');
  assert.equal((await s.getSubjectsForUser('other-user')).length, 0);
});

test('subject deletion cascades tasks, rescheduled blocks, reviews and materials while preserving other subjects/accounts', async t => {
  const s = await loadServices(':memory:', false, '2026-10-20T12:00:00Z');
  t.after(s.close);
  const db = await s.getDatabase();
  const subjects = [];
  for (const [user, name] of [['owner', 'Delete me'], ['owner', 'Keep mine'], ['other', 'Keep theirs']]) {
    const subject = await s.createSubject(user, { name });
    subjects.push(subject);
    const task = await s.createTask(user, { subject_id: subject.id, title: name });
    await s.createStudyBlock(user, { task_id: task.id, start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' });
    await s.createReflectionItem(user, { subject_id: subject.id, note: name });
    await db.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.id, task.id, name);
  }
  await s.markExpiredStudyBlocks('owner', '2026-10-20T12:00:00Z');
  const source = (await s.getStudyBlocksForUser('owner')).find(block => block.subject_id === subjects[0].id);
  await s.rescheduleStudyBlock('owner', source.id, '2026-10-20T12:00:00Z');
  const targetTaskIds = (await s.getTasksForUser('owner')).filter(task => task.subject_id === subjects[0].id).map(task => task.id);
  const before = {};
  for (const table of ['Subject', 'Task', 'StudyBlock', 'ReflectionItem', 'Material', 'JournalEntry']) before[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  await s.deleteSubject('owner', subjects[0].id);
  for (const table of Object.keys(before)) {
    const expected = before[table].filter(row => table === 'Subject' ? row.id !== subjects[0].id
      : table === 'StudyBlock' ? !targetTaskIds.includes(row.task_id) : row.subject_id !== subjects[0].id);
    assert.deepEqual(await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`), expected, `${table}: only the deleted subject's rows disappear`);
  }
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
  assert.equal((await s.getSubjectsForUser('owner'))[0].id, subjects[1].id);
  assert.equal((await s.getSubjectsForUser('other'))[0].id, subjects[2].id);
});

test('subject deletion rejects invalid/unowned IDs and rolls back all cascades on failure', async t => {
  const s = await loadServices();
  t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Preserve on failure' });
  await s.createTask('owner', { subject_id: subject.id, title: 'Keep task' });
  const db = await s.getDatabase();
  const snapshot = async () => {
    const data = {};
    for (const table of ['Subject', 'Task', 'StudyBlock', 'ReflectionItem', 'Material', 'JournalEntry']) data[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
    return data;
  };
  const before = await snapshot();
  for (const action of [
    () => s.deleteSubject('', subject.id),
    () => s.deleteSubject('other', subject.id),
    ...[0, -1, 1.5, '1 OR 1=1', 9999].map(id => () => s.deleteSubject('owner', id)),
  ]) { await assert.rejects(action); assert.deepEqual(await snapshot(), before); }
  await db.execAsync("CREATE TRIGGER reject_task_deletion BEFORE DELETE ON Task BEGIN SELECT RAISE(ABORT, 'Injected delete failure'); END");
  await assert.rejects(s.deleteSubject('owner', subject.id), /Injected delete failure/);
  assert.deepEqual(await snapshot(), before);
  await db.execAsync('DROP TRIGGER reject_task_deletion');
  await s.deleteSubject('owner', subject.id);
  await assert.rejects(s.deleteSubject('owner', subject.id), /belonging/);
});

test('task editing keeps history and metadata while changing owned title and subject in place', async t => {
  const s = await loadServices(); t.after(s.close);
  const first = await s.createSubject('owner', { name: 'Biology' });
  const second = await s.createSubject('owner', { name: 'Chemistry' });
  const task = await s.createTask('owner', { subject_id: first.id, title: 'Draft', deadline: '2026-11-02', estimated_minutes: 45 });
  const block = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-11-01T10:00:00Z', end_time: '2026-11-01T10:30:00Z' });
  const review = await s.createReflectionItem('owner', { subject_id: first.id, note: 'Original topic' });
  const db = await s.getDatabase();
  await db.runAsync('UPDATE Task SET postpone_count = 2 WHERE id = ?', task.id);
  await s.updateTask('owner', task.id, { title: "  Read O'Brien's notes; DROP TABLE Task; --  ", subject_id: second.id });
  const [updated] = await s.getTasksForUser('owner');
  assert.equal(updated.id, task.id); assert.equal(updated.title, "Read O'Brien's notes; DROP TABLE Task; --");
  assert.equal(updated.subject_id, second.id); assert.equal(updated.subject_name, 'Chemistry');
  assert.equal(updated.deadline, task.deadline); assert.equal(updated.estimated_minutes, 45);
  assert.equal(updated.postpone_count, 2); assert.equal(updated.status, 'pending');
  const [linked] = await s.getStudyBlocksForUser('owner');
  assert.equal(linked.id, block.id); assert.equal(linked.task_title, updated.title); assert.equal(linked.subject_id, second.id);
  assert.equal((await s.getReflectionsForUser('owner'))[0].id, review.id);
  assert.equal((await s.getReflectionsForUser('owner'))[0].subject_id, first.id, 'existing review topics stay under their original subject');
  await s.updateTask('owner', task.id, { title: updated.title, subject_id: second.id });
});

test('task update/delete reject invalid IDs, metadata and cross-account access without writes', async t => {
  const s = await loadServices(); t.after(s.close);
  const a = await s.createSubject('owner', { name: 'Biology' });
  const b = await s.createSubject('other', { name: 'History' });
  const task = await s.createTask('owner', { subject_id: a.id, title: 'Read' });
  const db = await s.getDatabase();
  const before = await db.getAllAsync('SELECT * FROM Task');
  for (const id of [0, -1, 1.5, '1', null, 9999]) {
    await assert.rejects(s.updateTask('owner', id, { title: 'New', subject_id: a.id }));
    await assert.rejects(s.deleteTask('owner', id));
  }
  for (const title of ['', ' ', null, 42, 'a'.repeat(257)]) await assert.rejects(s.updateTask('owner', task.id, { title, subject_id: a.id }));
  for (const subject_id of [0, -1, 1.5, '1', null, 9999, b.id]) await assert.rejects(s.updateTask('owner', task.id, { title: 'New', subject_id }));
  await assert.rejects(s.updateTask('other', task.id, { title: 'Taken', subject_id: b.id }));
  await assert.rejects(s.deleteTask('other', task.id));
  await assert.rejects(s.deleteTask('', task.id));
  assert.deepEqual(await db.getAllAsync('SELECT * FROM Task'), before);
});

test('task deletion cascades block history, preserves material notes/reviews/accounts, and rolls back on failure', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Read' });
  const retained = await s.createTask('owner', { subject_id: subject.id, title: 'Keep' });
  const otherSubject = await s.createSubject('other', { name: 'History' });
  const other = await s.createTask('other', { subject_id: otherSubject.id, title: 'Other' });
  const block = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z' });
  await s.markExpiredStudyBlocks('owner', '2026-10-20T10:00:00Z');
  await s.rescheduleStudyBlock('owner', block.id, '2026-10-20T10:00:00Z');
  const review = await s.createReflectionItem('owner', { subject_id: subject.id, note: 'Keep this review' });
  const db = await s.getDatabase();
  await db.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.id, task.id, 'Task notes');
  await db.runAsync('INSERT INTO Material (subject_id, title) VALUES (?, ?)', subject.id, 'Subject notes');
  await db.execAsync("CREATE TRIGGER fail_task_cascade BEFORE DELETE ON StudyBlock BEGIN SELECT RAISE(ABORT, 'Cascade failed'); END;");
  await assert.rejects(s.deleteTask('owner', task.id), /Cascade failed/);
  assert.equal((await s.getStudyBlocksForUser('owner')).length, 2);
  assert.equal((await s.getTasksForUser('owner')).length, 2);
  assert.equal((await db.getAllAsync('SELECT * FROM Material')).length, 2);
  await db.execAsync('DROP TRIGGER fail_task_cascade');
  await s.deleteTask('owner', task.id);
  assert.deepEqual((await s.getTasksForUser('owner')).map(row => row.id), [retained.id]);
  assert.equal((await s.getStudyBlocksForUser('owner')).length, 0);
  assert.equal((await s.getTasksForUser('other'))[0].id, other.id);
  assert.equal((await s.getSubjectsForUser('owner'))[0].id, subject.id);
  assert.equal((await s.getReflectionsForUser('owner'))[0].id, review.id);
  const materials = await db.getAllAsync('SELECT * FROM Material ORDER BY id');
  assert.equal(materials.length, 2);
  assert.deepEqual(materials.map(row => row.title), ['Task notes', 'Subject notes']);
  assert.ok(materials.every(row => row.subject_id === subject.id && row.task_id === null));
});

test('task session summaries cover future dates independently of Home and preserve unresolved missed history', async t => {
  const s = await loadServices(); t.after(s.close);
  const subject = await s.createSubject('owner', { name: 'Biology' });
  const task = await s.createTask('owner', { subject_id: subject.id, title: 'Read' });
  const missed = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z' });
  await s.markExpiredStudyBlocks('owner', '2026-10-20T10:00:00Z');
  let [row] = await s.getTasksForUser('owner');
  assert.equal(row.has_missed_session, 1); assert.equal(row.latest_scheduled_start, null);
  await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:15:00Z' });
  const future = await s.createStudyBlock('owner', { task_id: task.id, start_time: '2026-10-27T09:00:00Z', end_time: '2026-10-27T09:30:00Z' });
  [row] = await s.getTasksForUser('owner');
  assert.equal(row.has_missed_session, 1, 'a fresh commitment does not erase historical misses');
  assert.equal(row.latest_scheduled_start, future.start_time, 'an earlier scheduled block cannot mask a later future commitment');
  assert.ok(Date.parse(row.latest_scheduled_start) > Date.parse('2026-10-20T11:00:00Z'));
  const home = await s.getStudyBlocksForUser('owner', { date: '2026-10-20', includeUnresolvedMissed: true });
  assert.ok(home.some(block => block.id === missed.id)); assert.ok(!home.some(block => block.id === future.id));
  await (await s.getDatabase()).runAsync('DELETE FROM StudyBlock WHERE id = ?', future.id);
  [row] = await s.getTasksForUser('owner');
  assert.ok(Date.parse(row.latest_scheduled_start) <= Date.parse('2026-10-20T11:00:00Z'));
  await s.rescheduleStudyBlock('owner', missed.id, '2026-10-20T10:00:00Z');
  [row] = await s.getTasksForUser('owner');
  assert.equal(row.has_missed_session, 0, 'a linked replacement resolves that missed badge');
  assert.equal((await s.getTasksForUser('other')).length, 0);
});

test('binds SQL input safely and validates empty or invalid input', async t => {
  const services = await loadServices();
  t.after(services.close);
  const user = "user' OR 1=1 --";
  const subject = await services.createSubject(user, { name: "Art'); DROP TABLE Subject; --", field_colors: '#AA88FF' });
  const title = "Review O'Brien's notes";
  await services.createTask(user, { title, subject_id: subject.id, deadline: '2026-10-21T12:00:00Z', estimated_minutes: 45 });
  assert.equal((await services.getTasksForUser(user))[0].title, title);
  assert.equal((await services.getSubjectsForUser(user))[0].name, subject.name);
  assert.equal((await services.getSubjectsForUser('other')).length, 0);
  for (const call of [
    () => services.getSubjectsForUser(' '),
    () => services.getTasksForUser(''),
    () => services.createSubject('', { name: 'Math' }),
    () => services.createSubject(user, { name: ' ' }),
    () => services.createSubject(user, { name: 'Math', field_colors: 'invalid' }),
    () => services.createSubject(user, { name: 'Math', field_of_study: ' , ' }),
    () => services.createSubject(user, { name: 'Math', field_colors: '#AA88FF,#00FF00,#FF0000' }),
    () => services.createSubject(user, { name: 'Math', field_colors: '#AA88FF,#aa88ff' }),
    () => services.createTask('', { title, subject_id: subject.id }),
    () => services.createTask(user, { title: ' ', subject_id: subject.id }),
    () => services.createTask(user, { title, subject_id: -1 }),
    () => services.createTask(user, { title, subject_id: 9999 }),
    () => services.createTask(user, { title, subject_id: subject.id, estimated_minutes: 0 }),
    () => services.createTask(user, { title, subject_id: subject.id, deadline: 'invalid' }),
  ]) await assert.rejects(call);
  assert.equal((await services.getTasksForUser(user)).length, 1);
});

test('retries initialization after a storage failure', async t => {
  const services = await loadServices(':memory:', true);
  t.after(services.close);
  await assert.rejects(services.getSubjectsForUser('user-a'), /Storage unavailable/);
  assert.deepEqual(plain(await services.getSubjectsForUser('user-a')), []);
  assert.equal(services.opens, 2);
});

test('retains saved subjects and tasks after closing and reopening the database', async t => {
  const filename = path.join(os.tmpdir(), `yotei-db-test-${randomUUID()}.db`);
  const instances = [];
  t.after(async () => {
    for (const instance of instances) await instance.close();
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
    }
  });
  const first = await loadServices(filename);
  instances.push(first);
  const subject = await first.createSubject('returning-user', { name: 'Physics' });
  const task = await first.createTask('returning-user', { title: 'Practice forces', subject_id: subject.id });
  const block = await first.createStudyBlock('returning-user', {
    task_id: task.id, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T09:30:00Z',
  });
  const taskSnapshot = plain(await first.getTasksForUser('returning-user'));
  // Simulate the existing database before the scheduler indexes were added.
  const database = await first.getDatabase();
  await database.execAsync('DROP INDEX idx_task_user_deadline; DROP INDEX idx_study_block_task_time;');
  await first.close();
  const second = await loadServices(filename);
  instances.push(second);
  assert.deepEqual(plain(await second.getSubjectsForUser('returning-user')), [plain(subject)]);
  assert.deepEqual(plain(await second.getTasksForUser('returning-user')), taskSnapshot);
  assert.deepEqual(plain(await second.getStudyBlocksForUser('returning-user')), [plain(block)]);
});

test('creates study blocks with task titles, UTC times, ownership checks and validation', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Practice algebra', subject_id: subject.id });
  const input = { task_id: task.id, start_time: '2026-10-20T17:00:00+08:00', end_time: '2026-10-20T17:30:00+08:00' };
  const block = await services.createStudyBlock('user-a', input);
  assert.equal(block.task_title, task.title);
  assert.equal(block.start_time, '2026-10-20T09:00:00.000Z');
  assert.equal(block.end_time, '2026-10-20T09:30:00.000Z');
  assert.equal(Date.parse(block.end_time) - Date.parse(block.start_time), 30 * 60 * 1000);
  assert.equal(block.status, 'scheduled');
  assert.deepEqual(plain(await services.getStudyBlocksForUser('user-a')), [plain(block)]);
  assert.equal((await services.getStudyBlocksForUser('user-b')).length, 0);
  await assert.rejects(services.createStudyBlock('user-b', input), /belonging to your account/);
  for (const call of [
    () => services.getStudyBlocksForUser(''),
    () => services.createStudyBlock('', input),
    () => services.createStudyBlock('user-a', { ...input, task_id: 0 }),
    () => services.createStudyBlock('user-a', { ...input, task_id: 99999 }),
    () => services.createStudyBlock('user-a', { ...input, start_time: 'invalid' }),
    () => services.createStudyBlock('user-a', { ...input, end_time: input.start_time }),
    () => services.createStudyBlock('user-a', { ...input, end_time: '2026-10-19T00:00:00Z' }),
  ]) await assert.rejects(call);
  assert.equal((await services.getStudyBlocksForUser('user-a')).length, 1);
});

test('date queries include due tasks and overlapping sessions once, with exclusive midnight boundaries', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Physics' });
  const otherSubject = await services.createSubject('user-b', { name: 'Biology' });
  const date = '2026-10-20';
  const local = hour => new Date(`2026-10-20T${hour}:00:00`).toISOString();
  const due = await services.createTask('user-a', { title: 'Due today', subject_id: subject.id, deadline: local('12') });
  const calendarDue = await services.createTask('user-a', { title: 'Calendar deadline', subject_id: subject.id, deadline: date });
  const scheduled = await services.createTask('user-a', { title: 'Scheduled today', subject_id: subject.id });
  const crossing = await services.createTask('user-a', { title: 'Crosses midnight', subject_id: subject.id });
  const endingAtMidnight = await services.createTask('user-a', { title: 'Ends as today begins', subject_id: subject.id });
  const tomorrow = await services.createTask('user-a', { title: 'Tomorrow', subject_id: subject.id, deadline: new Date('2026-10-21T00:00:00').toISOString() });
  const other = await services.createTask('user-b', { title: 'Other user', subject_id: otherSubject.id, deadline: date });
  await services.createStudyBlock('user-a', { task_id: due.id, start_time: local('10'), end_time: local('11') });
  for (const hour of ['09', '14']) {
    await services.createStudyBlock('user-a', { task_id: scheduled.id, start_time: local(hour), end_time: new Date(Date.parse(local(hour)) + 30 * 60 * 1000).toISOString() });
  }
  await services.createStudyBlock('user-a', { task_id: crossing.id, start_time: new Date('2026-10-19T23:45:00').toISOString(), end_time: local('01') });
  await services.createStudyBlock('user-a', { task_id: endingAtMidnight.id, start_time: new Date('2026-10-19T23:00:00').toISOString(), end_time: local('00') });
  await services.createStudyBlock('user-a', { task_id: tomorrow.id, start_time: new Date('2026-10-21T00:00:00').toISOString(), end_time: new Date('2026-10-21T00:30:00').toISOString() });
  await services.createStudyBlock('user-b', { task_id: other.id, start_time: local('09'), end_time: local('10') });
  const expectedIds = [due.id, calendarDue.id, scheduled.id, crossing.id].sort((a, b) => b - a);
  assert.deepEqual((await services.getTasksForDate('user-a', date)).map(task => task.id), expectedIds);
  assert.deepEqual((await services.getTasksForUser('user-a', { date, hasDeadline: true })).map(task => task.id), [calendarDue.id, due.id]);
  assert.deepEqual((await services.getTasksWithDeadlines('user-a')).map(task => task.id), [tomorrow.id, calendarDue.id, due.id]);
  const blocks = await services.getStudyBlocksForUser('user-a', { date });
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].task_id, crossing.id);
  assert.equal(blocks.some(block => [endingAtMidnight.id, tomorrow.id, other.id].includes(block.task_id)), false);
  await assert.rejects(services.getTasksForDate('user-a', '2026-02-30'), /valid calendar date/);
  await assert.rejects(services.getStudyBlocksForUser('user-a', { date: '10/20/2026' }), /YYYY-MM-DD/);
  await assert.rejects(services.getTasksWithDeadlines(''), /Sign in/);
});

test('local day ranges advance calendar days, including daylight-saving changes', async t => {
  const services = await loadServices();
  t.after(services.close);
  for (const date of ['2026-03-08', '2026-11-01', '2026-12-31', '2028-02-29']) {
    const range = services.getLocalDayRange(date);
    assert.equal(Date.parse(range.start), new Date(`${date}T00:00:00`).getTime());
    const end = new Date(`${date}T12:00:00`);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    assert.equal(Date.parse(range.end), end.getTime());
  }
  if (process.env.TZ === 'America/New_York') {
    const spring = services.getLocalDayRange('2026-03-08');
    const autumn = services.getLocalDayRange('2026-11-01');
    assert.equal(Date.parse(spring.end) - Date.parse(spring.start), 23 * 60 * 60 * 1000);
    assert.equal(Date.parse(autumn.end) - Date.parse(autumn.start), 25 * 60 * 60 * 1000);
  }
});

test('detects missed blocks per account and preserves done sessions during automatic updates', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Physics' });
  const task = await services.createTask('user-a', { title: 'Practice forces', subject_id: subject.id });
  const otherSubject = await services.createSubject('user-b', { name: 'Biology' });
  const otherTask = await services.createTask('user-b', { title: 'Cell notes', subject_id: otherSubject.id });
  const make = (taskId, start, end) => services.createStudyBlock(taskId === task.id ? 'user-a' : 'user-b', {
    task_id: taskId, start_time: `2026-10-20T${start}:00Z`, end_time: `2026-10-20T${end}:00Z`,
  });
  const overdue = await make(task.id, '09:00', '09:15');
  const boundary = await make(task.id, '09:30', '10:00');
  const active = await make(task.id, '09:45', '10:15');
  const completed = await make(task.id, '08:00', '08:30');
  const other = await make(otherTask.id, '09:00', '09:30');
  await services.updateStudyBlockStatus('user-a', completed.id, 'done');
  const reference = '2026-10-20T10:00:00Z';
  assert.deepEqual((await services.getMissedBlocksForUser('user-a', reference)).map(block => block.id), [overdue.id]);
  assert.equal((await services.markExpiredStudyBlocks('user-a', reference)).changes, 1);
  assert.equal((await services.markExpiredStudyBlocks('user-a', reference)).changes, 0);
  assert.equal((await services.getMissedBlocksForUser('user-a', reference)).length, 0);
  const blocks = await services.getStudyBlocksForUser('user-a');
  assert.equal(blocks.find(block => block.id === overdue.id).status, 'missed');
  assert.equal(blocks.find(block => block.id === boundary.id).status, 'scheduled');
  assert.equal(blocks.find(block => block.id === completed.id).status, 'done');
  assert.equal((await services.getStudyBlocksForUser('user-b'))[0].status, 'scheduled');
  assert.equal((await services.updateStudyBlockStatus('user-a', active.id, 'done')).status, 'done');
  assert.equal((await services.updateStudyBlockStatus('user-a', active.id, 'done')).status, 'done');
  await assert.rejects(services.updateStudyBlockStatus('user-a', active.id, 'missed'), /already been resolved/);
  await assert.rejects(services.updateStudyBlockStatus('user-a', other.id, 'done'), /belonging to your account/);
  await assert.rejects(services.updateStudyBlockStatus('user-a', boundary.id, 'invalid'), /done or missed/);
  await assert.rejects(services.updateStudyBlockStatus('', active.id, 'done'), /Sign in/);
  await assert.rejects(services.getMissedBlocksForUser('user-a', 'invalid'), /valid reference/);
});

test('reschedules once an hour ahead, preserving all four durations and original history', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  const reference = '2026-10-20T10:00:00Z';
  for (const duration of [15, 30, 45, 60]) {
    const start = Date.parse('2026-10-19T09:00:00Z');
    const original = await services.createStudyBlock('user-a', {
      task_id: task.id, start_time: new Date(start).toISOString(), end_time: new Date(start + duration * 60_000).toISOString(),
    });
    await services.updateStudyBlockStatus('user-a', original.id, 'missed');
    await assert.rejects(services.rescheduleStudyBlock('user-b', original.id, reference), /belonging to your account/);
    const [first, retry] = await Promise.all([
      services.rescheduleStudyBlock('user-a', original.id, reference), services.rescheduleStudyBlock('user-a', original.id, reference),
    ]);
    assert.equal(first.id, retry.id);
    assert.equal(first.start_time, '2026-10-20T11:00:00.000Z');
    assert.equal(Date.parse(first.end_time) - Date.parse(first.start_time), duration * 60_000);
    assert.equal(first.status, 'scheduled');
    assert.equal(first.rescheduled_from, original.id);
    const saved = await services.getStudyBlocksForUser('user-a');
    const history = saved.find(block => block.id === original.id);
    assert.equal(history.status, 'missed');
    assert.equal(history.start_time, original.start_time);
    assert.equal(history.rescheduled_to, first.id);
    assert.equal(saved.filter(block => block.rescheduled_from === original.id).length, 1);
    await assert.rejects(services.rescheduleStudyBlock('user-a', first.id, reference), /Only missed/);
  }
  assert.equal((await services.getStudyBlocksForUser('user-a')).length, 8);
  assert.equal((await services.getStudyBlocksForUser('user-b')).length, 0);
});

test('surfaces older unresolved misses and supports rescheduling across midnight', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  const original = await services.createStudyBlock('user-a', {
    task_id: task.id, start_time: new Date('2026-10-19T14:00:00').toISOString(), end_time: new Date('2026-10-19T14:45:00').toISOString(),
  });
  const now = new Date('2026-10-20T23:30:00').toISOString();
  await services.markExpiredStudyBlocks('user-a', now);
  assert.equal((await services.getStudyBlocksForUser('user-a', { date: '2026-10-20' })).length, 0);
  assert.equal((await services.getStudyBlocksForUser('user-a', { date: '2026-10-20', includeUnresolvedMissed: true }))[0].id, original.id);
  const replacement = await services.rescheduleStudyBlock('user-a', original.id, now);
  assert.equal(services.getLocalDateKey(new Date(replacement.start_time)), '2026-10-21');
  assert.equal((await services.getStudyBlocksForUser('user-a', { date: '2026-10-20', includeUnresolvedMissed: true })).length, 0);
  assert.equal((await services.getStudyBlocksForUser('user-a', { date: '2026-10-21' }))[0].id, replacement.id);
});

test('migrates legacy planned blocks without losing data and can reopen safely', async t => {
  const filename = path.join(os.tmpdir(), `yotei-legacy-test-${randomUUID()}.db`);
  const instances = [];
  t.after(async () => {
    for (const instance of instances) await instance.close();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
  });
  const legacy = new DatabaseSync(filename);
  try {
    legacy.exec(`
      CREATE TABLE Subject (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, UNIQUE(id, user_id));
      CREATE TABLE Task (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, subject_id INTEGER NOT NULL, title TEXT NOT NULL, deadline TEXT, estimated_minutes INTEGER DEFAULT 30, status TEXT DEFAULT 'pending', postpone_count INTEGER DEFAULT 0);
      CREATE TABLE StudyBlock (id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES Task(id), start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned');
      INSERT INTO Subject VALUES (1, 'user-a', 'Math', '#B8A0F5');
      CREATE TABLE ReviewItem (id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL REFERENCES Subject(id), topic TEXT NOT NULL, last_reviewed_at TEXT, next_review_at TEXT);
      CREATE TABLE Material (id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL REFERENCES Subject(id), task_id INTEGER REFERENCES Task(id), title TEXT NOT NULL, url_or_note TEXT, local_file_path TEXT);
      INSERT INTO ReviewItem VALUES (1, 1, 'Algebra recall', NULL, NULL);
      INSERT INTO Material VALUES (1, 1, NULL, 'Notes', NULL, NULL);
      INSERT INTO Task (id, user_id, subject_id, title) VALUES (1, 'user-a', 1, 'Algebra');
      INSERT INTO StudyBlock VALUES (1, 1, '2026-10-19T09:00:00Z', '2026-10-19T09:30:00Z', 'planned');
      INSERT INTO StudyBlock VALUES (2, 1, '2026-10-19T10:00:00Z', '2026-10-19T10:30:00Z', 'done');
    `);
  } finally { legacy.close(); }
  const first = await loadServices(filename);
  instances.push(first);
  const migrated = await first.getStudyBlocksForUser('user-a');
  const migratedSubject = (await first.getSubjectsForUser('user-a'))[0];
  assert.equal(migratedSubject.id, 1);
  assert.equal(migratedSubject.subject_code, 'GEN-101');
  assert.equal(migratedSubject.field_of_study, 'General');
  assert.equal(migratedSubject.field_colors, '#B8A0F5');
  assert.equal(migrated[0].subject_color, '#B8A0F5');
  assert.equal((await (await first.getDatabase()).getAllAsync('PRAGMA table_info(Subject)')).some(column => column.name === 'color'), false);
  assert.equal((await first.getReflectionsForUser('user-a'))[0].note, 'Algebra recall');
  const migratedDb = await first.getDatabase();
  assert.deepEqual((await migratedDb.getAllAsync('PRAGMA table_info(ReflectionItem)')).map(column => column.name), ['id', 'subject_id', 'study_block_id', 'note', 'created_at']);
  assert.equal(await migratedDb.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'ReviewItem'"), null);
  assert.equal((await first.getTasksForUser('user-a'))[0].description, null);
  assert.equal((await (await first.getDatabase()).getFirstAsync('SELECT subject_id FROM Material WHERE id = 1')).subject_id, 1);
  assert.deepEqual(await (await first.getDatabase()).getAllAsync('PRAGMA foreign_key_check'), []);
  assert.deepEqual(migrated.map(block => block.status), ['scheduled', 'done']);
  assert.equal(migrated[0].rescheduled_from, null);
  assert.equal(migrated[0].actual_start_time, null);
  assert.equal(migrated[0].break_started_at, null);
  assert.equal(migrated[0].break_time_minutes, 0);
  assert.equal(migrated[0].break_time_ms, 0);
  assert.equal(migrated[0].actual_study_seconds, 0);
  await first.markExpiredStudyBlocks('user-a', '2026-10-20T09:00:00Z');
  const replacement = await first.rescheduleStudyBlock('user-a', 1, '2026-10-20T09:00:00Z');
  assert.equal((await first.getTasksForUser('user-a'))[0].postpone_count, 1);
  // Older versions created reschedule history without updating this counter.
  await (await first.getDatabase()).runAsync('UPDATE Task SET postpone_count = 0 WHERE id = ? AND user_id = ?', 1, 'user-a');
  await first.close();
  const second = await loadServices(filename);
  instances.push(second);
  const reopened = await second.getStudyBlocksForUser('user-a');
  assert.equal(reopened.length, 3);
  assert.equal(reopened.find(block => block.id === 1).rescheduled_to, replacement.id);
  assert.equal(reopened.find(block => block.id === 2).status, 'done');
  assert.equal((await second.getTasksForUser('user-a'))[0].postpone_count, 1);
  const database = await second.getDatabase();
  assert.deepEqual(plain(await second.getSubjectsForUser('user-a')), [plain(migratedSubject)]);
  assert.equal((await database.getAllAsync('PRAGMA table_info(StudyBlock)')).filter(column => column.name === 'rescheduled_from').length, 1);
});

test('warns above 240 minutes, permits exactly 240, and writes only after an explicit override', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  const date = '2026-10-20';
  const input = (hour, minutes) => {
    const start = new Date(`${date}T${hour}:00:00`).getTime();
    return { task_id: task.id, start_time: new Date(start).toISOString(), end_time: new Date(start + minutes * 60000).toISOString() };
  };
  const first = await services.createStudyBlock('user-a', input('08', 220));
  await services.createStudyBlock('user-a', input('13', 20));
  assert.equal(await services.getDailyStudyMinutes('user-a', date), 240);
  await assert.rejects(services.createStudyBlock('user-a', input('14', 5)), error => {
    assert.equal(error.name, 'StudyLoadWarning');
    assert.equal(error.days[0].current_minutes, 240);
    assert.equal(error.days[0].total_minutes, 245);
    return true;
  });
  assert.equal((await services.getStudyBlocksForUser('user-a')).length, 2);
  await services.createStudyBlock('user-a', input('14', 5), { allowHeavyDay: true });
  assert.equal(await services.getDailyStudyMinutes('user-a', date), 245);
  await services.updateStudyBlockStatus('user-a', first.id, 'done');
  assert.equal(await services.getDailyStudyMinutes('user-a', date), 245);
  assert.equal(await services.getDailyStudyMinutes('user-b', date), 0);
  const otherSubject = await services.createSubject('user-b', { name: 'Biology' });
  const otherTask = await services.createTask('user-b', { title: 'Cell notes', subject_id: otherSubject.id });
  await services.createStudyBlock('user-b', { ...input('08', 240), task_id: otherTask.id });
  assert.equal(await services.getDailyStudyMinutes('user-b', date), 240);
  assert.equal(await services.getDailyStudyMinutes('user-a', date), 245);
});

test('serializes simultaneous scheduling requests so the second sees the updated daily total', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  const input = minutes => ({ task_id: task.id, start_time: new Date('2026-10-20T08:00:00').toISOString(), end_time: new Date(new Date('2026-10-20T08:00:00').getTime() + minutes * 60000).toISOString() });
  await services.createStudyBlock('user-a', input(230));
  const results = await Promise.allSettled([services.createStudyBlock('user-a', input(10)), services.createStudyBlock('user-a', input(10))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.name === 'StudyLoadWarning').length, 1);
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-20'), 240);
});

test('splits workload at local midnight and excludes missed history from daily totals', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  const morning = await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-20T08:00:00').toISOString(), end_time: new Date('2026-10-20T11:45:00').toISOString() });
  await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-20T23:50:00').toISOString(), end_time: new Date('2026-10-21T00:20:00').toISOString() });
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-20'), 235);
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-21'), 20);
  await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-21T08:00:00').toISOString(), end_time: new Date('2026-10-21T11:40:00').toISOString() });
  await assert.rejects(services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-20T23:59:00').toISOString(), end_time: new Date('2026-10-21T00:01:00').toISOString() }), error => {
    assert.equal(error.days[0].date, '2026-10-21');
    assert.equal(error.days[0].total_minutes, 241);
    return true;
  });
  await services.updateStudyBlockStatus('user-a', morning.id, 'missed');
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-20'), 10);
});

test('increments postponement counts once per replacement and applies guardrails to custom reschedules', async t => {
  const services = await loadServices();
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Math' });
  const task = await services.createTask('user-a', { title: 'Algebra', subject_id: subject.id });
  await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-20T08:00:00').toISOString(), end_time: new Date('2026-10-20T12:00:00').toISOString() });
  const original = await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-19T08:00:00').toISOString(), end_time: new Date('2026-10-19T08:05:00').toISOString() });
  await services.updateStudyBlockStatus('user-a', original.id, 'missed');
  const reference = new Date('2026-10-20T12:00:00').toISOString();
  const options = { start_time: new Date('2026-10-20T14:30:00').toISOString(), end_time: new Date('2026-10-20T14:47:00').toISOString() };
  await assert.rejects(services.rescheduleStudyBlock('user-a', original.id, reference, options), error => error.name === 'StudyLoadWarning');
  assert.equal((await services.getTasksForUser('user-a'))[0].postpone_count, 0);
  const replacement = await services.rescheduleStudyBlock('user-a', original.id, reference, { ...options, allowHeavyDay: true });
  assert.equal(replacement.start_time, options.start_time);
  assert.equal(Date.parse(replacement.end_time) - Date.parse(replacement.start_time), 17 * 60000);
  await services.rescheduleStudyBlock('user-a', original.id, reference, options);
  assert.equal((await services.getTasksForUser('user-a'))[0].postpone_count, 1);
  await services.updateStudyBlockStatus('user-a', replacement.id, 'missed');
  await services.rescheduleStudyBlock('user-a', replacement.id, reference, { ...options, allowHeavyDay: true });
  assert.equal((await services.getTasksForUser('user-a'))[0].postpone_count, 2);
  assert.equal((await services.getTasksForUser('user-b')).length, 0);
});


test('selected full dates allow 5 PM today at 4 PM and any future calendar date', async t => {
  const services = await loadServices(); t.after(services.close);
  const now = new Date('2026-10-22T16:00:00');
  for (const date of ['2026-10-22', '2026-10-23', '2026-10-29', '2027-01-08']) {
    const start = new Date(date + 'T17:00:00');
    const end = new Date(date + 'T18:00:00');
    assert.deepEqual(plain(services.buildStudyTimes({ start, end }, now)), { start_time: start.toISOString(), end_time: end.toISOString() });
  }
  // Tomorrow's morning is future even though its clock is earlier than 4 PM.
  assert.doesNotThrow(() => services.buildStudyTimes({ start: new Date('2026-10-23T08:00:00'), end: new Date('2026-10-23T09:00:00') }, now));
  const end = new Date('2026-10-22T18:00:00');
  for (const start of [new Date('2026-10-22T15:59:59'), new Date('2026-10-21T17:00:00')]) {
    assert.throws(() => services.buildStudyTimes({ start, end }, now), /already passed/);
  }
  assert.doesNotThrow(() => services.buildStudyTimes({ start: now, end }, now), 'only instants already passed are blocked');
  const start = new Date('2026-10-29T17:00:00');
  for (const invalidEnd of [start, new Date('2026-10-29T16:00:00')]) {
    assert.throws(() => services.buildStudyTimes({ start, end: invalidEnd }, now), /after the start/);
  }
  for (const invalid of [new Date(NaN), null, '2026-10-29', 123]) {
    assert.throws(() => services.buildStudyTimes({ start: invalid, end }, now), /valid start and end/);
    assert.throws(() => services.buildStudyTimes({ start, end: invalid }, now), /valid start and end/);
  }
  assert.throws(() => services.buildStudyTimes({ start, end }, new Date(NaN)), /current date/);
  const preserved = { start: new Date('2026-10-29T17:00:00'), end: new Date('2026-10-29T18:00:00') };
  assert.equal(services.buildStudyTimes(preserved, new Date('2026-10-23T00:01:00')).start_time, preserved.start.toISOString(), 'midnight does not move the chosen date');
  assert.throws(() => services.buildStudyTimes(preserved, new Date('2026-10-29T17:01:00')), /already passed/, 'stale confirmation cannot save a passed start');
});

test('native date/time edits preserve local components, chosen duration and source values', async t => {
  const services = await loadServices(); t.after(services.close);
  const original = { start: new Date('2026-10-22T17:00:00'), end: new Date('2026-10-22T18:00:00') };
  const chosen = services.updateStudyWindow(original, 'start', 'date', new Date('2026-10-29T00:00:00'));
  assert.equal(chosen.start.toISOString(), new Date('2026-10-29T17:00:00').toISOString());
  assert.equal(chosen.end.toISOString(), new Date('2026-10-29T18:00:00').toISOString());
  const timed = services.updateStudyWindow(chosen, 'start', 'time', new Date('1999-01-05T18:30:44'));
  assert.equal(timed.start.toISOString(), new Date('2026-10-29T18:30:00').toISOString(), 'clock pick cannot replace the selected calendar date');
  assert.equal(timed.end.toISOString(), new Date('2026-10-29T19:30:00').toISOString());
  const endDate = services.updateStudyWindow(timed, 'end', 'date', new Date('2026-10-30T00:00:00'));
  const overnight = services.updateStudyWindow(endDate, 'end', 'time', new Date('2026-10-30T00:20:00'));
  assert.equal(overnight.start.getTime(), timed.start.getTime());
  assert.equal(overnight.end.toISOString(), new Date('2026-10-30T00:20:00').toISOString());
  assert.equal(original.start.toISOString(), new Date('2026-10-22T17:00:00').toISOString(), 'edits do not mutate the input window');
  assert.equal(original.end.toISOString(), new Date('2026-10-22T18:00:00').toISOString());
  for (const [field, part, picked] of [['wrong', 'date', new Date()], ['start', 'wrong', new Date()], ['start', 'date', new Date(NaN)]]) {
    assert.throws(() => services.updateStudyWindow(original, field, part, picked), /valid/);
  }
});

test('initial native picker windows preserve coaching, original and multi-day durations across midnight', async t => {
  const services = await loadServices(); t.after(services.close);
  const now = new Date('2026-10-22T16:00:43');
  for (const duration of [5, 30, 83, 7 * 1440]) {
    const window = services.getInitialStudyWindow(now, duration);
    assert.equal(window.start.toISOString(), new Date('2026-10-22T16:01:00').toISOString());
    assert.equal(window.end.getTime() - window.start.getTime(), duration * 60000);
    assert.doesNotThrow(() => services.buildStudyTimes(window, now));
  }
  const yearEnd = new Date('2026-12-31T23:59:42');
  const initial = services.getInitialStudyWindow(yearEnd, 5);
  assert.equal(initial.start.toISOString(), new Date('2027-01-01T00:00:00').toISOString());
  assert.equal(initial.end.getTime() - initial.start.getTime(), 5 * 60000);
  assert.throws(() => services.getInitialStudyWindow(new Date(NaN)), /current date/);
  assert.throws(() => services.getInitialStudyWindow(now, Number.MAX_VALUE), /too long/);
});

test('next-week picker intervals enforce exact 240-minute SQLite workload and explicit override', async t => {
  const services = await loadServices(); t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Mathematics' });
  const task = await services.createTask('user-a', { title: 'Practice algebra', subject_id: subject.id });
  const now = new Date('2026-10-22T16:00:00');
  const times = (start, end) => services.buildStudyTimes({ start: new Date(start), end: new Date(end) }, now);
  for (const window of [times('2026-10-29T08:00:00', '2026-10-29T11:00:00'), times('2026-10-29T17:00:00', '2026-10-29T18:00:00')]) {
    await services.createStudyBlock('user-a', { task_id: task.id, ...window });
  }
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-29'), 240);
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-22'), 0);
  const extra = times('2026-10-29T19:00:00', '2026-10-29T19:01:00');
  await assert.rejects(services.createStudyBlock('user-a', { task_id: task.id, ...extra }), error => {
    assert.equal(error.name, 'StudyLoadWarning');
    assert.deepEqual(plain(error.days), [{ date: '2026-10-29', current_minutes: 240, added_minutes: 1, total_minutes: 241 }]);
    return true;
  });
  assert.equal((await services.getStudyBlocksForUser('user-a')).length, 2);
  await services.createStudyBlock('user-a', { task_id: task.id, ...extra }, { allowHeavyDay: true });
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-29'), 241);
  assert.equal(await services.getDailyStudyMinutes('user-b', '2026-10-29'), 0);
  assert.equal((await services.getStudyBlocksForUser('user-a', { date: '2026-10-29' })).length, 3);
});

test('native future overnight dates split SQLite workload across the selected calendar days', async t => {
  const services = await loadServices(); t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Biology' });
  const task = await services.createTask('user-a', { title: 'Read genetics', subject_id: subject.id });
  const now = new Date('2026-10-22T16:00:00');
  const input = (start, end) => ({ task_id: task.id, ...services.buildStudyTimes({ start: new Date(start), end: new Date(end) }, now) });
  await services.createStudyBlock('user-a', input('2026-10-30T08:00:00', '2026-10-30T12:00:00'));
  const overnight = input('2026-10-29T23:50:00', '2026-10-30T00:20:00');
  await assert.rejects(services.createStudyBlock('user-a', overnight), error => {
    assert.deepEqual(plain(error.days), [{ date: '2026-10-30', current_minutes: 240, added_minutes: 20, total_minutes: 260 }]);
    return true;
  });
  await services.createStudyBlock('user-a', overnight, { allowHeavyDay: true });
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-29'), 10);
  assert.equal(await services.getDailyStudyMinutes('user-a', '2026-10-30'), 260);
});

test('native future-date rescheduling preserves the selection and counts a postponement once', async t => {
  const services = await loadServices(); t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'History' });
  const task = await services.createTask('user-a', { title: 'Make notes', subject_id: subject.id });
  const original = await services.createStudyBlock('user-a', { task_id: task.id, start_time: new Date('2026-10-21T18:00:00').toISOString(), end_time: new Date('2026-10-21T18:30:00').toISOString() });
  await services.updateStudyBlockStatus('user-a', original.id, 'missed');
  const now = new Date('2026-10-22T16:00:00');
  const chosen = services.buildStudyTimes({ start: new Date('2026-10-29T17:00:00'), end: new Date('2026-10-29T18:00:00') }, now);
  const replacement = await services.rescheduleStudyBlock('user-a', original.id, now.toISOString(), chosen);
  assert.equal(replacement.start_time, chosen.start_time);
  assert.equal(replacement.end_time, chosen.end_time);
  assert.equal(replacement.rescheduled_from, original.id);
  assert.equal((await services.rescheduleStudyBlock('user-a', original.id, now.toISOString(), chosen)).id, replacement.id);
  assert.equal((await services.getTasksForUser('user-a'))[0].postpone_count, 1);
  await assert.rejects(services.rescheduleStudyBlock('user-b', original.id, now.toISOString(), chosen), /belonging to your account/);
});

test('native picker instants preserve DST offsets and calendar edits reject unavailable local times', { skip: process.env.TZ !== 'America/New_York' }, async t => {
  const services = await loadServices(); t.after(services.close);
  const spring = services.buildStudyTimes({ start: new Date('2026-03-08T01:30:00-05:00'), end: new Date('2026-03-08T03:30:00-04:00') }, new Date('2026-03-07T12:00:00'));
  assert.equal(Date.parse(spring.end_time) - Date.parse(spring.start_time), 60 * 60000);
  const original = { start: new Date('2026-03-07T02:30:00'), end: new Date('2026-03-07T03:30:00') };
  assert.throws(() => services.updateStudyWindow(original, 'start', 'date', new Date('2026-03-08T12:00:00')), /unavailable/);
  const now = new Date('2026-11-01T01:50:00-04:00');
  const window = { start: new Date('2026-11-01T01:30:00-05:00'), end: new Date('2026-11-01T02:00:00-05:00') };
  assert.doesNotThrow(() => services.buildStudyTimes(window, now), 'the second 1:30 is future despite the earlier clock');
  assert.equal(services.updateStudyWindow(window, 'start', 'date', new Date('2026-11-01T12:00:00')).start.getTime(), window.start.getTime(), 're-selecting the same date preserves a repeated-hour instant');
  assert.equal(services.updateStudyWindow(window, 'start', 'time', window.start).start.getTime(), window.start.getTime());
  for (const timestamp of ['2026-11-01T01:50:00-04:00', '2026-11-01T01:50:00-05:00']) {
    const reference = new Date(timestamp);
    const initial = services.getInitialStudyWindow(reference, 30);
    assert.ok(initial.start > reference);
    assert.equal(initial.end - initial.start, 30 * 60000);
  }
});


test('six-month seeding compiles each SQL shape once and finalizes every statement on success or failure', async t => {
  const s = await loadServices(':memory:', false, '2026-10-29T12:00:00'); t.after(s.close);
  const counts = await s.seedDemoData('owner');
  assert.ok(counts.studyBlocks > 250);
  assert.equal(s.prepared.length, new Set(s.prepared).size);
  assert.ok(s.prepared.length < 20, 'hundreds of inserts reuse fewer than 20 SQL statements');
  assert.deepEqual(s.finalized, s.prepared);
  const db = await s.getDatabase(), prepare = db.prepareAsync;
  db.prepareAsync = async sql => {
    if (sql.includes('INSERT INTO StudyBlock')) throw new Error('Prepare failed');
    return prepare(sql);
  };
  const count = s.prepared.length;
  await assert.rejects(s.seedDemoData('owner'), /Prepare failed/);
  assert.deepEqual(s.finalized.slice(count), s.prepared.slice(count));
  assert.equal((await s.getSubjectsForUser('owner')).length, 20, 'failed replacement rolled back');
});
