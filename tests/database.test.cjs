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
async function loadServices(filename = ':memory:', failFirstInitialization = false, now) {
  class FixedDate extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(now);
    }
    static now() { return Date.parse(now); }
  }
  const context = vm.createContext(now ? { Date: FixedDate } : {});
  const connections = [];
  let opens = 0;
  const sqlite = new vm.SyntheticModule(['openDatabaseAsync'], function () {
    this.setExport('openDatabaseAsync', async name => {
      assert.equal(name, 'yotei.db');
      opens += 1;
      const native = new DatabaseSync(filename);
      let closed = false;
      const connection = {
        execAsync: async sql => {
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
  const reviews = await load('./db/ReviewService.js', parent);
  await reviews.evaluate();
  const database = modules.get(path.resolve('db/database.js')).namespace;
  return {
    ...subjects.namespace, ...tasks.namespace, ...blocks.namespace, ...dates, ...database, ...loadService, ...scheduling.namespace, ...demo.namespace, ...reviews.namespace,
    setNow: value => { now = value; },
    get opens() { return opens; },
    close: async () => { for (const connection of connections) await connection.closeAsync(); },
  };
}

const plain = value => JSON.parse(JSON.stringify(value));

test('review queue binds topics, validates input, and isolates accounts for every operation', async t => {
  const services = await loadServices(':memory:', false, '2026-10-20T12:00:00Z');
  t.after(services.close);
  const user = "review-user' OR 1=1 --";
  const subject = await services.createSubject(user, { name: 'Biology' });
  const otherSubject = await services.createSubject('other-user', { name: 'History' });
  const topic = "Cell division'); DROP TABLE ReviewItem; --";
  const item = await services.createReviewItem(user, { subject_id: subject.id, topic: `  ${topic}  ` });
  const other = await services.createReviewItem('other-user', { subject_id: otherSubject.id, topic: 'French Revolution' });
  assert.equal(item.topic, topic);
  assert.equal(item.subject_name, 'Biology');
  assert.equal(item.last_reviewed_at, null);
  assert.equal(item.next_review_at, null);
  assert.deepEqual(plain(await services.getDueReviews(user)), [plain(item)]);
  assert.deepEqual(plain(await services.getDueReviews('other-user')), [plain(other)]);
  for (const action of [
    () => services.createReviewItem(user, { subject_id: otherSubject.id, topic: 'Wrong subject' }),
    () => services.createReviewItem(user, { subject_id: 9999, topic: 'Missing subject' }),
    () => services.createReviewItem(user, { subject_id: -1, topic: 'Invalid subject' }),
    () => services.createReviewItem(user, { subject_id: subject.id, topic: ' ' }),
    () => services.createReviewItem(user, { subject_id: subject.id, topic: 'x'.repeat(257) }),
    () => services.createReviewItem(user, { subject_id: subject.id, topic: null }),
    () => services.createReviewItem('', { subject_id: subject.id, topic: 'Invalid user' }),
    () => services.getDueReviews(' '),
    () => services.markReviewed(user, other.id, 'Good'),
    () => services.markReviewed('', item.id, 'Hard'),
    () => services.markReviewed(user, 0, 'Good'),
    () => services.markReviewed(user, 99999, 'Good'),
    () => services.markReviewed(user, item.id, 'Unknown'),
    () => services.markReviewed(user, item.id, '__proto__'),
    () => services.markReviewed(user, item.id, null),
  ]) await assert.rejects(action());
  assert.deepEqual(plain(await services.getDueReviews(user)), [plain(item)], 'invalid calls do not update or create reviews');
  assert.deepEqual(plain(await services.getDueReviews('other-user')), [plain(other)], 'another account is unchanged');
});

test('due reviews include new, past, and exact-boundary timestamps but exclude the future', async t => {
  const services = await loadServices(':memory:', false, '2026-10-20T12:00:00.000Z');
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'Mathematics' });
  const database = await services.getDatabase();
  const deadlines = [null, '2026-10-19T12:00:00Z', '2026-10-20T12:00:00.000Z', '2026-10-20T12:00:00.001Z', '2026-10-20T20:00:00+08:00'];
  const items = [];
  for (const deadline of deadlines) {
    const item = await services.createReviewItem('user-a', { subject_id: subject.id, topic: String(deadline) });
    await database.runAsync('UPDATE ReviewItem SET next_review_at = ? WHERE id = ?', deadline, item.id);
    items.push(item);
  }
  assert.deepEqual((await services.getDueReviews('user-a')).map(item => item.id), [items[0].id, items[1].id, items[2].id, items[4].id]);
});

test('ratings remove reviews from the due queue until 1, 3, or 7 calendar days later', async t => {
  for (const [difficulty, days] of [['Hard', 1], ['Good', 3], ['Easy', 7]]) {
    await t.test(difficulty, async t => {
      const now = '2026-10-20T12:15:00Z';
      const services = await loadServices(':memory:', false, now);
      t.after(services.close);
      const subject = await services.createSubject('user-a', { name: 'Biology' });
      const item = await services.createReviewItem('user-a', { subject_id: subject.id, topic: 'Cell division' });
      const result = await services.markReviewed('user-a', item.id, difficulty);
      assert.equal(result.last_reviewed_at, now.replace('Z', '.000Z'));
      assert.equal(result.next_review_at, `2026-10-${20 + days}T12:15:00.000Z`);
      assert.equal((await services.getDueReviews('user-a')).length, 0);
      await assert.rejects(services.markReviewed('user-a', item.id, 'Easy'), /no longer due/);
      services.setNow(new Date(Date.parse(result.next_review_at) - 1).toISOString());
      assert.equal((await services.getDueReviews('user-a')).length, 0);
      services.setNow(result.next_review_at);
      assert.equal((await services.getDueReviews('user-a'))[0].id, item.id);
      const repeated = await services.markReviewed('user-a', item.id, 'Hard');
      assert.equal(repeated.last_reviewed_at, result.next_review_at);
      assert.ok(Date.parse(repeated.next_review_at) > Date.parse(result.next_review_at));
    });
  }
});

test('review intervals preserve local time across daylight-saving and month boundaries', async t => {
  for (const localNow of ['2026-03-07T12:30:00', '2026-10-31T12:30:00', '2026-12-31T12:30:00']) {
    const services = await loadServices(':memory:', false, localNow);
    t.after(services.close);
    const subject = await services.createSubject('user-a', { name: 'Biology' });
    const item = await services.createReviewItem('user-a', { subject_id: subject.id, topic: 'Genetics' });
    const result = await services.markReviewed('user-a', item.id, 'Hard');
    const expected = new Date(localNow);
    expected.setDate(expected.getDate() + 1);
    assert.equal(result.next_review_at, expected.toISOString());
    assert.equal(new Date(result.next_review_at).getHours(), 12);
    assert.equal(new Date(result.next_review_at).getMinutes(), 30);
  }
});

test('concurrent review ratings update a due occurrence once', async t => {
  const services = await loadServices(':memory:', false, '2026-10-20T12:00:00Z');
  t.after(services.close);
  const subject = await services.createSubject('user-a', { name: 'History' });
  const item = await services.createReviewItem('user-a', { subject_id: subject.id, topic: 'Industrial Revolution' });
  const results = await Promise.allSettled([
    services.markReviewed('user-a', item.id, 'Hard'), services.markReviewed('user-a', item.id, 'Easy'),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal((await services.getDueReviews('user-a')).length, 0);
});

test('review schedule survives reopening the database', async t => {
  const filename = path.join(os.tmpdir(), `yotei-review-test-${randomUUID()}.db`);
  const instances = [];
  t.after(async () => {
    for (const instance of instances) await instance.close();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
  });
  const first = await loadServices(filename, false, '2026-10-20T12:00:00Z');
  instances.push(first);
  const subject = await first.createSubject('user-a', { name: 'Biology' });
  const item = await first.createReviewItem('user-a', { subject_id: subject.id, topic: 'Photosynthesis' });
  const reviewed = await first.markReviewed('user-a', item.id, 'Good');
  await first.close();
  const second = await loadServices(filename, false, reviewed.next_review_at);
  instances.push(second);
  assert.deepEqual(plain(await second.getDueReviews('user-a')), [plain(reviewed)]);
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
    await database.runAsync('INSERT INTO ReviewItem (subject_id, topic) VALUES (?, ?)', subject.id, 'Old review');
    await database.runAsync('INSERT INTO Material (subject_id, task_id, title) VALUES (?, ?, ?)', subject.id, task.id, 'Old notes');
    snapshots[user] = { subject, task, blocks: plain(await services.getStudyBlocksForUser(user)) };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.deepEqual(plain(await services.seedDemoData('demo-user')), { subjects: 3, tasks: 6, studyBlocks: 4, totalMinutes: 240 });
    const subjects = await services.getSubjectsForUser('demo-user');
    const tasks = await services.getTasksForUser('demo-user');
    assert.deepEqual(subjects.map(subject => subject.name).sort(), ['Biology', 'History', 'Mathematics']);
    assert.equal(tasks.length, 6);
    assert.equal(tasks.filter(task => task.postpone_count >= 2).length, 2);
    assert.equal(tasks[0].postpone_count, 2, 'coaching examples appear first');
    assert.equal(tasks.filter(task => task.deadline === '2026-10-20').length, 2);
    assert.equal(tasks.filter(task => task.deadline === '2026-10-21').length, 3);
    assert.equal(tasks.filter(task => task.deadline === '2026-10-19').length, 1);
    assert.equal((await services.getStudyBlocksForUser('demo-user')).length, 4);
    assert.deepEqual(plain(await services.getSubjectsForUser('other-user')), [plain(snapshots['other-user'].subject)]);
    assert.deepEqual(plain(await services.getTasksForUser('other-user')), [plain(snapshots['other-user'].task)]);
    assert.deepEqual(plain(await services.getStudyBlocksForUser('other-user')), snapshots['other-user'].blocks);
    for (const table of ['ReviewItem', 'Material']) {
      const rows = await database.getAllAsync(`SELECT * FROM ${table}`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].subject_id, snapshots['other-user'].subject.id);
    }
  }
  await assert.rejects(services.seedDemoData(' '), /Sign in/i);
});

test('demo data rolls back completely if an insert fails after the reset', async t => {
  const services = await loadServices();
  t.after(services.close);
  await services.seedDemoData('demo-user');
  const database = await services.getDatabase();
  const before = {};
  const tables = ['Subject', 'Task', 'StudyBlock', 'ReviewItem', 'Material'];
  for (const table of tables) before[table] = await database.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  const run = database.runAsync;
  database.runAsync = async (sql, ...params) => {
    if (sql.includes('INSERT INTO Task')) throw new Error('Simulated disk error');
    return run(sql, ...params);
  };
  await assert.rejects(services.seedDemoData('demo-user'), /Simulated disk error/);
  database.runAsync = run;
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
      await services.seedDemoData('demo-user');
      const today = services.getLocalDateKey(new Date(localNow));
      const { start, end } = services.getLocalDayRange(today);
      const blocks = await services.getStudyBlocksForUser('demo-user', { date: today });
      assert.equal(blocks.length, 4);
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
      assert.equal((await services.getStudyBlocksForUser('demo-user')).length, 4, 'warning inserts no data');
      const confirmed = await services.createStudyBlock('demo-user', input, { allowHeavyDay: true });
      assert.equal(confirmed.status, 'scheduled');
    });
  }
});

test('initializes all five tables and shares one ready connection', async t => {
  const services = await loadServices();
  t.after(services.close);
  const [first, second] = await Promise.all([services.getDatabase(), services.getDatabase()]);
  assert.equal(first, second);
  assert.equal(services.opens, 1);
  const tables = await first.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  assert.deepEqual(tables.map(row => row.name), ['Material', 'ReviewItem', 'StudyBlock', 'Subject', 'Task']);
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

test('binds SQL input safely and validates empty or invalid input', async t => {
  const services = await loadServices();
  t.after(services.close);
  const user = "user' OR 1=1 --";
  const subject = await services.createSubject(user, { name: "Art'); DROP TABLE Subject; --", color: '#AA88FF' });
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
    () => services.createSubject(user, { name: 'Math', color: 'invalid' }),
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
  // Simulate the existing database before the scheduler indexes were added.
  const database = await first.getDatabase();
  await database.execAsync('DROP INDEX idx_task_user_deadline; DROP INDEX idx_study_block_task_time;');
  await first.close();
  const second = await loadServices(filename);
  instances.push(second);
  assert.deepEqual(plain(await second.getSubjectsForUser('returning-user')), [plain(subject)]);
  assert.deepEqual(plain(await second.getTasksForUser('returning-user')), [plain(task)]);
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
      INSERT INTO Task (id, user_id, subject_id, title) VALUES (1, 'user-a', 1, 'Algebra');
      INSERT INTO StudyBlock VALUES (1, 1, '2026-10-19T09:00:00Z', '2026-10-19T09:30:00Z', 'planned');
      INSERT INTO StudyBlock VALUES (2, 1, '2026-10-19T10:00:00Z', '2026-10-19T10:30:00Z', 'done');
    `);
  } finally { legacy.close(); }
  const first = await loadServices(filename);
  instances.push(first);
  const migrated = await first.getStudyBlocksForUser('user-a');
  assert.deepEqual(migrated.map(block => block.status), ['scheduled', 'done']);
  assert.equal(migrated[0].rescheduled_from, null);
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

test('validates custom duration and local HH:mm inputs without silently moving past times', async t => {
  const services = await loadServices();
  t.after(services.close);
  const now = new Date('2026-10-20T12:00:00');
  const nowTimes = services.buildStudyTimes({ duration: '7', mode: 'now', time: '' }, now);
  assert.equal(nowTimes.start_time, now.toISOString());
  assert.equal(Date.parse(nowTimes.end_time) - Date.parse(nowTimes.start_time), 7 * 60000);
  const custom = services.buildStudyTimes({ duration: '83', mode: 'custom', time: '14:30' }, now);
  assert.equal(custom.start_time, new Date('2026-10-20T14:30:00').toISOString());
  assert.equal(Date.parse(custom.end_time) - Date.parse(custom.start_time), 83 * 60000);
  for (const duration of ['0', '-5', '1.5', 'abc', '', '1e2']) assert.throws(() => services.buildStudyTimes({ duration, mode: 'now', time: '' }, now));
  for (const time of ['24:00', '14:60', '2:30', '12:00', '09:00', 'tomorrow']) assert.throws(() => services.buildStudyTimes({ duration: '25', mode: 'custom', time }, now));
  const overnight = services.buildStudyTimes({ duration: '30', mode: 'custom', time: '23:50' }, now);
  assert.equal(services.getLocalDateKey(new Date(overnight.end_time)), '2026-10-21');
});
