const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const subject = { id: 7, user_id: 'owner', name: 'Biology', subject_code: 'BIO-101', field_of_study: 'Sciences', field_colors: '#123ABC' };
const task = { id: 9, user_id: 'owner', subject_id: 7, title: 'Read cells', subject_name: 'Biology', subject_color: '#123ABC', postpone_count: 0 };
function find(node, type, predicate = () => true) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type && predicate(node.props)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, type, predicate); if (result) return result; }
}

// Compile actual components; substitute only hooks/native/storage transports.
async function setup(file, { failure = false, hold = false, warn = false } = {}) {
  let slots = [];
  const instances = new Map(), alerts = [], updates = [], subjectUpdates = [], deletions = [], actions = [], schedules = [], animations = [];
  let cursor = 0, effects = [], refreshes = 0, saved = 0, release;
  const gate = hold ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  class StudyLoadWarning extends Error { constructor() { super('Heavy day'); this.days = [{ date: '2026-10-26', current_minutes: 0, added_minutes: 270, total_minutes: 270 }]; } }
  const data = { tasks: [task], subjects: [subject, { ...subject, id: 8, name: 'Chemistry' }], blocks: [], ready: true, refreshing: false,
    refresh: async () => { refreshes++; } };
  const study = { data, clock: Date.parse('2026-10-20T11:00:00Z'), disabled: false, demoRevision: 0,
    openEditTask: value => actions.push(['edit', value]), confirmDeleteTask: value => actions.push(['delete', value]),
    openSchedule: value => actions.push(['schedule', value]) };
  const hooks = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => study,
    useState(initial) {
      const owner = slots;
      const i = cursor++;
      if (!owner[i]) owner[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [owner[i].value, value => { owner[i].value = typeof value === 'function' ? value(owner[i].value) : value; }];
    },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !deps || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !deps || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i] = { deps }; effects.push(fn); }
    },
  };
  const theme = { useTheme: () => ({ colors: { text: '#000000' }, isDark: false, subjectColor: color => color }), useThemedStyles: () => ({ taskActionText: { color: '#000000' } }) };
  const controls = Object.fromEntries(['Button', 'FieldLabel', 'InfoButton', 'Input', 'Message', 'Pill', 'Sheet'].map(name => [name, name]));
  const modules = {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
      StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) }, AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate({ outputRange }) { return outputRange[this.value ? 1 : 0]; } },
        timing: (value, config) => ({ start() { animations.push(config); value.setValue(config.toValue); }, stop() {} }) } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useScrollToTop() {}, router: { navigate() {} } },
    '../auth': { USE_REAL_AUTH: false },
    '../auth/SessionContext': { useSession: () => ({ user: { id: 'owner' }, signingOut: false, signOut() {} }) },
    '../ThemeContext': theme,
    '../db/SubjectService': { createSubject() {}, deleteSubject() {}, updateSubject: async (...args) => { subjectUpdates.push(args); } },
    '../db/TaskService': { createTask: async () => { throw new Error('Unexpected task creation'); },
      updateTask: async (...args) => { updates.push(args); await gate; if (failure) throw new Error('Disk error'); },
      deleteTask: async (...args) => { deletions.push(args); await gate; if (failure) throw new Error('Disk error'); } },
    '../db/dateUtils': { getLocalDateKey: () => '2026-10-20' },
    '../db/StudyBlockService': { finishStudyBlock() {}, pauseStudyBlock() {}, resumeStudyBlock() {}, startStudyBlock() {},
      createStudyBlock: async (...args) => { schedules.push(args); if (warn && !args[2]?.allowHeavyDay) throw new StudyLoadWarning(); return { id: 27, ...args[1] }; },
      rescheduleStudyBlock: async (...args) => { schedules.push(args); return { id: 28, ...args[3] }; } },
    '../db/StudyLoadService': { StudyLoadWarning },
    '../db/seedData': { seedDemoData() {} }, '../db/ReviewService': { createReviewItem() {}, markReviewed() {} },
    '../db/BackupService': { exportBackup() {}, importBackup() {} },
    '../hooks/useDashboardData': { useDashboardData: () => data },
    './EntrySheet': { default: 'EntrySheet' }, './ScheduleSheet': { default: 'ScheduleSheet' }, './CompletionReviewSheet': { default: 'CompletionReviewSheet' },
    './DateTimeField': { default: 'DateTimeField' },
    './StudyWorkspace': { useStudy: () => study }, '../components/StudyWorkspace': { useStudy: () => study },
    './ui': controls, '../components/ui': controls,
    './studyStyles': { createStudyStyles() {} }, '../components/studyStyles': { createStudyStyles() {} },
    '../components/StudyCards': Object.fromEntries(['EmptyState', 'Feedback', 'ScreenHeader', 'TaskCard'].map(name => [name, name])),
    '../components/SubjectBookshelf': { default: 'Bookshelf' },
    './theme': { formatTime() {}, formatMinutes() {} }, '../utils/focusTimer': { formatElapsed() {} },
  };
  const context = vm.createContext({ Date, setInterval: () => 1, clearInterval() {} });
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file.replace(/\.js$/, '.jsx'), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async name => {
    if (name === '../utils/subjectFields' || name === '../utils/scheduling') {
      const fields = new vm.SourceTextModule(fs.readFileSync(name.slice(3) + '.js', 'utf8'), { context });
      await fields.link(() => { throw new Error('Unexpected field dependency'); }); return fields;
    }
    assert.ok(modules[name], `Missing dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
      for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  function render(props = {}, exported = 'default') {
    const component = typeof exported === 'function' ? exported : module.namespace[exported];
    const key = `${component.name}-${props.subject?.id ?? ''}`;
    if (!instances.has(key)) instances.set(key, []);
    slots = instances.get(key);
    cursor = 0; effects = [];
    let output = component(props);
    if (exported === 'StudyWorkspace') output = output.type(output.props);
    for (const effect of effects) effect();
    return output;
  }
  return { render, data, study, alerts, updates, subjectUpdates, deletions, actions, schedules, animations, release: () => release?.(),
    fail: value => { failure = value; }, saved: () => saved, onSaved: () => { saved++; },
    refreshes: () => refreshes, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('task editor prefills both fields, saves once, and keeps failed drafts available', async () => {
  const s = await setup('components/EntrySheet.js', { failure: true });
  const props = { kind: 'task', userId: 'owner', subjects: s.data.subjects, editingTask: task, onSaved: s.onSaved, onClose() {}, onDeleted() {} };
  const render = () => s.render(props);
  assert.equal(render().props.title, 'Edit task');
  const input = find(render(), 'Input'); assert.equal(input.props.value, task.title);
  assert.equal(find(render(), 'Pill', props => props.label === 'Biology').props.selected, true);
  input.props.onChangeText('New title'); find(render(), 'Pill', props => props.label === 'Chemistry').props.onPress();
  find(render(), 'Button', props => props.label === 'Save changes').props.onPress(); await s.flush();
  assert.equal(s.saved(), 0); assert.equal(find(render(), 'Input').props.value, 'New title');
  assert.match(find(render(), 'Message').props.text, /draft is still here/);
  s.fail(false); find(render(), 'Button', props => props.label === 'Save changes').props.onPress(); await s.flush();
  assert.deepEqual(s.updates.map(args => JSON.parse(JSON.stringify(args))), [['owner', 9, { title: 'New title', subject_id: 8 }], ['owner', 9, { title: 'New title', subject_id: 8 }]]);
  assert.equal(s.saved(), 1);
});

test('task deletion requires confirmation, guards duplicate actions, refreshes and supports failure/retry', async () => {
  const s = await setup('components/StudyWorkspace.js', { hold: true, failure: true });
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  let workspace = render(); workspace.confirmDeleteTask(task); workspace.confirmDeleteTask(task);
  assert.equal(s.alerts.length, 1); assert.equal(s.deletions.length, 0); assert.equal(render().disabled, true);
  s.alerts[0][2][0].onPress(); assert.equal(render().disabled, false);
  workspace = render(); workspace.confirmDeleteTask(task); s.alerts[1][3].onDismiss(); assert.equal(render().disabled, false);
  render().confirmDeleteTask(task);
  const confirm = s.alerts[2][2][1].onPress; confirm(); confirm(); s.alerts[2][3].onDismiss();
  render().openEditTask(task); assert.equal(render().entry, null, 'pending deletion blocks edits');
  assert.deepEqual(s.deletions, [['owner', 9]]); s.release(); await s.flush();
  assert.equal(s.refreshes(), 0); assert.match(render().error, /Could not delete/); assert.equal(render().disabled, false);
  s.fail(false); render().confirmDeleteTask(task); s.alerts[3][2][1].onPress(); await s.flush();
  assert.equal(s.refreshes(), 1); assert.equal(render().notice, 'Task deleted.');
  render().openEditTask(task); assert.equal(render().editingTask, task); assert.equal(render().entry, 'task');
});

test('Library hides a missed badge for any future scheduled commitment and restores it when none remains', async () => {
  const s = await setup('screens/LibraryScreen.js');
  const renderTask = row => {
    s.data.tasks = [row];
    const list = find(s.render(), 'FlatList');
    return list.props.renderItem({ item: row }).props;
  };
  assert.equal(renderTask({ ...task, has_missed_session: 1, latest_scheduled_start: null }).hasMissedSession, true);
  assert.equal(renderTask({ ...task, has_missed_session: 1, latest_scheduled_start: '2026-10-27T12:00:00Z' }).hasMissedSession, false);
  assert.equal(renderTask({ ...task, has_missed_session: 1, latest_scheduled_start: '2026-10-20T10:00:00Z' }).hasMissedSession, true);
  assert.equal(renderTask({ ...task, has_missed_session: 0, latest_scheduled_start: null }).hasMissedSession, false);
});

test('task cards expose edit/delete actions and only render a requested missed badge', async () => {
  const s = await setup('components/StudyCards.js');
  const render = hasMissedSession => s.render({ task, hasMissedSession }, 'TaskCard');
  assert.equal(find(render(false), 'Text', props => props.children === 'Missed Session'), undefined);
  assert.ok(find(render(true), 'Text', props => props.children === 'Missed Session'));
  find(render(false), 'Pressable', props => props.accessibilityLabel === 'Edit Read cells').props.onPress();
  find(render(false), 'Pressable', props => props.accessibilityLabel === 'Delete Read cells').props.onPress();
  assert.deepEqual(s.actions, [['edit', task], ['delete', task]]);
});

test('subject editor prefills and saves the normalized code with the existing metadata', async () => {
  const s = await setup('components/EntrySheet.js');
  const props = { kind: 'subject', userId: 'owner', subjects: s.data.subjects, editingSubject: subject, onSaved: s.onSaved, onClose() {}, onDeleted() {} };
  const render = () => s.render(props);
  assert.equal(find(render(), 'Input', p => p.label === 'Subject code').props.value, 'BIO-101');
  find(render(), 'Input', p => p.label === 'Subject code').props.onChangeText(' bio-201 ');
  find(render(), 'Button', p => p.label === 'Save changes').props.onPress(); await s.flush();
  assert.equal(s.subjectUpdates[0][2].subject_code, 'BIO-201'); assert.equal(s.saved(), 1);
});

test('spines reveal covers without filtering; covers select, edit separately, and return to the shelf', async () => {
  const s = await setup('components/SubjectBookshelf.js');
  const selections = [], edits = [];
  const props = { subjects: [subject], taskCounts: new Map([[7, 3]]), selectedId: null, onSelect: id => selections.push(id), onEdit: value => edits.push(value) };
  const getBook = () => {
    const shelf = s.render(props);
    const scroll = find(shelf, 'ScrollView');
    return scroll.props.children[0];
  };
  const renderBook = () => { const book = getBook(); return s.render(book.props, book.type); };
  let book = renderBook(); await s.flush();
  assert.equal(find(book, 'Text', p => p.children === subject.name), undefined, 'the full name is not shown on the spine');
  assert.ok(find(book, 'Text', p => p.children === subject.subject_code));
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')).props.onPress();
  assert.equal(selections.length, 0);
  book = renderBook();
  assert.ok(find(book, 'Text', p => p.children === subject.name));
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Edit ')).props.onPress();
  assert.deepEqual(edits, [subject]); assert.equal(selections.length, 0);
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Open ')).props.onPress();
  assert.deepEqual(selections, [7]);
  props.selectedId = 7; book = renderBook();
  assert.equal(find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Open ')).props.accessibilityState.selected, true);
  assert.ok(find(book, 'Text', p => p.children === 'Selected'));
  assert.ok(s.animations.some(config => config.toValue === 1));
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Return ')).props.onPress();
  assert.ok(find(renderBook(), 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')));
  find(s.render(props), 'Pressable', p => p.accessibilityLabel === 'Show All Tasks').props.onPress();
  assert.equal(selections.at(-1), null);
});

test('duration edits calculate End, moving Start preserves duration, and manual End takes precedence', async () => {
  const s = await setup('components/ScheduleSheet.js');
  const props = { userId: 'owner', task, onClose() {}, onSaved: s.onSaved };
  const render = () => s.render(props);
  const duration = () => find(render(), 'Input', p => p.label === 'Duration (optional)');
  duration().props.onChangeText('4h 30m');
  let start = find(render(), 'DateTimeField', p => p.label === 'Start').props;
  let end = find(render(), 'DateTimeField', p => p.label === 'End').props;
  assert.equal(end.value.getTime() - start.value.getTime(), 270 * 60000);
  const tomorrow = new Date(start.value); tomorrow.setDate(tomorrow.getDate() + 1);
  start.onChange(tomorrow, 'date');
  start = find(render(), 'DateTimeField', p => p.label === 'Start').props;
  end = find(render(), 'DateTimeField', p => p.label === 'End').props;
  assert.equal(end.value.getTime() - start.value.getTime(), 270 * 60000);
  end.onChange(new Date(start.value.getTime() + 45 * 60000), 'time');
  assert.equal(duration().props.value, '');
  duration().props.onChangeText('-5m');
  assert.equal(find(render(), 'Button', p => p.label === 'Save session').props.disabled, true);
  duration().props.onSubmitEditing(); await s.flush(); assert.equal(s.schedules.length, 0);
  duration().props.onChangeText('45m');
  find(render(), 'Button', p => p.label === 'Save session').props.onPress(); await s.flush();
  assert.equal(s.saved(), 1);
  assert.equal((Date.parse(s.schedules[0][1].end_time) - Date.parse(s.schedules[0][1].start_time)) / 60000, 45);
});

test('duration-based scheduling retains the workload confirmation and reschedule options', async () => {
  const s = await setup('components/ScheduleSheet.js', { warn: true });
  const props = { userId: 'owner', task, onClose() {}, onSaved: s.onSaved };
  const render = () => s.render(props);
  find(render(), 'Input').props.onChangeText('4h 30m');
  find(render(), 'Button', p => p.label === 'Save session').props.onPress(); await s.flush();
  assert.equal(s.saved(), 0); assert.ok(find(render(), 'Button', p => p.label === 'Schedule anyway'));
  find(render(), 'Button', p => p.label === 'Schedule anyway').props.onPress(); await s.flush();
  assert.equal(s.saved(), 1); assert.equal(s.schedules[1][2].allowHeavyDay, true);
  assert.equal(s.schedules[0][1].start_time, s.schedules[1][1].start_time);
  assert.equal(s.schedules[0][1].end_time, s.schedules[1][1].end_time);
  const r = await setup('components/ScheduleSheet.js');
  const reschedule = () => r.render({ ...props, sourceBlock: { id: 4 }, onSaved: r.onSaved });
  find(reschedule(), 'Input').props.onChangeText('2h');
  find(reschedule(), 'Button', p => p.label === 'Reschedule session ↗').props.onPress(); await r.flush();
  assert.equal(r.schedules[0][1], 4);
  assert.equal((Date.parse(r.schedules[0][3].end_time) - Date.parse(r.schedules[0][3].start_time)) / 60000, 120);
});
