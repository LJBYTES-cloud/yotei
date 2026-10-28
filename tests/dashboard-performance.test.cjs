const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

async function setupDashboard() {
  const slots = []; let cursor = 0, effects = [], queries = 0;
  const rows = {
    subjects: [{ id: 1, name: 'Biology' }], tasks: [{ id: 2, title: 'Cells' }], blocks: [],
    journal: Array.from({ length: 1000 }, (_, id) => ({ id: `entry-${id}`, title: `Note ${id}`, content: `Observation ${id}` })),
    weekly: [{ date: '2026-10-29', minutes: 45 }], materials: [],
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { value: fn(), deps };
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        const old = slots[index]; slots[index] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const read = key => async () => { queries++; return structuredClone(rows[key]); };
  const modules = {
    react,
    '../db/SubjectService': { getSubjectsForUser: read('subjects') },
    '../db/TaskService': { getTasksForUser: read('tasks') },
    '../db/StudyBlockService': { getStudyBlocksForUser: read('blocks'), markExpiredStudyBlocks: async () => {} },
    '../db/CoachService': { getCoachHistory: async () => ({ completedToday: true, completedYesterday: true, bestHour: 9 }) },
    '../db/StudyLoadService': { getDailyStudyMinutes: async () => 45 },
    '../db/JournalService': { getJournalFeedForUser: read('journal') },
    '../db/ProgressService': { getWeeklyStudyMinutes: read('weekly') },
    '../db/MaterialService': { getMaterialsForUser: read('materials') },
  };
  const context = vm.createContext({});
  const stable = new vm.SourceTextModule(fs.readFileSync('utils/stableData.js', 'utf8'), { context });
  await stable.link(() => { throw new Error('Unexpected stable-row dependency'); }); await stable.evaluate();
  const module = new vm.SourceTextModule(fs.readFileSync('hooks/useDashboardData.js', 'utf8'), { context });
  await module.link(name => {
    if (name === '../utils/stableData') return stable;
    assert.ok(modules[name], name);
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
      for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return {
    rows,
    render() { cursor = 0; effects = []; const result = module.namespace.useDashboardData('owner', '2026-10-29'); effects.forEach(fn => fn()); return result; },
    flush: () => new Promise(resolve => setImmediate(resolve)),
    queries: () => queries,
  };
}

test('background refresh preserves the snapshot and 1,000 unchanged journal row identities', async () => {
  const s = await setupDashboard(); s.render(); await s.flush();
  const before = s.render(); assert.equal(before.ready, true);
  await before.refresh(true);
  const after = s.render();
  assert.equal(after, before, 'unchanged refresh must not invalidate list context');
  assert.equal(after.journal[999], before.journal[999]);
  assert.ok(s.queries() >= 12, 'real refresh queries returned fresh objects, not cached fixtures');
});

test('editing one journal note invalidates that row while reordering retains all other records', async () => {
  const s = await setupDashboard(); s.render(); await s.flush();
  const before = s.render();
  s.rows.journal[500].content = 'Edited observation';
  await before.refresh(true);
  const edited = s.render();
  assert.notEqual(edited.journal[500], before.journal[500]);
  assert.equal(edited.journal[499], before.journal[499]);
  assert.equal(edited.subjects, before.subjects); assert.equal(edited.weekly, before.weekly);
  s.rows.journal.reverse(); await edited.refresh(true);
  const reordered = s.render();
  assert.equal(reordered.journal[999], before.journal[0]);
  assert.equal(reordered.journal[499], edited.journal[500]);
});

test('screen clocks stop offscreen and in background, then catch up on focus without shared state', async () => {
  let now = 1000, value, focus, listener, next = 0;
  const intervals = new Map();
  const context = vm.createContext({ Date: { now: () => now }, setInterval: fn => { intervals.set(++next, fn); return next; }, clearInterval: id => intervals.delete(id) });
  const modules = {
    react: { useState: initial => { value = initial(); return [value, nextValue => { value = nextValue; }]; }, useCallback: fn => fn },
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, fn) => { listener = fn; return { remove: () => { listener = null; } }; } } },
  };
  const module = new vm.SourceTextModule(fs.readFileSync('hooks/useScreenClock.js', 'utf8'), { context });
  await module.link(name => new vm.SyntheticModule(Object.keys(modules[name]), function () {
    for (const [key, item] of Object.entries(modules[name])) this.setExport(key, item);
  }, { context })); await module.evaluate(); module.namespace.useScreenClock();
  assert.equal(intervals.size, 0); const blur = focus(); assert.equal(intervals.size, 1);
  now = 5000; listener('background'); assert.equal(intervals.size, 0);
  now = 10000; listener('active'); assert.equal(value, 10000); assert.equal(intervals.size, 1);
  blur(); assert.equal(intervals.size, 0); assert.equal(listener, null);
});
