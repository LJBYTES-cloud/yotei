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
async function loadServices(filename = ':memory:', failFirstInitialization = false) {
  const context = vm.createContext({});
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
  const database = modules.get(path.resolve('db/database.js')).namespace;
  return {
    ...subjects.namespace, ...tasks.namespace, ...database,
    get opens() { return opens; },
    close: async () => { for (const connection of connections) await connection.closeAsync(); },
  };
}

const plain = value => JSON.parse(JSON.stringify(value));

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
  await first.close();
  const second = await loadServices(filename);
  instances.push(second);
  assert.deepEqual(plain(await second.getSubjectsForUser('returning-user')), [plain(subject)]);
  assert.deepEqual(plain(await second.getTasksForUser('returning-user')), [plain(task)]);
});
