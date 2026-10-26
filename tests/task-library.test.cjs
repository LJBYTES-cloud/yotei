const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const subject = { id: 7, user_id: 'owner', name: 'Biology', subject_code: 'BIO-101', field_of_study: 'Sciences', field_colors: '#123ABC' };
const task = { id: 9, user_id: 'owner', subject_id: 7, title: 'Read cells', subject_name: 'Biology', subject_color: '#123ABC', postpone_count: 0 };
function find(node, type, predicate = () => true, includeHidden = false) {
  if (!node || typeof node !== 'object') return;
  if (!includeHidden && node.props?.importantForAccessibility === 'no-hide-descendants') return;
  if (node.type === type && predicate(node.props)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, type, predicate, includeHidden); if (result) return result; }
}

// Compile actual components; substitute only hooks/native/storage transports.
async function setup(file, { failure = false, hold = false, warn = false, dark = false, reduceMotion = false, holdAnimations = false } = {}) {
  let slots = [];
  const instances = new Map(), alerts = [], updates = [], createdSubjects = [], subjectUpdates = [], subjectDeletions = [], deletions = [], actions = [], schedules = [], animations = [];
  let routeSubjectId = '7';
  let cursor = 0, effects = [], refreshes = 0, saved = 0, release;
  const gate = hold ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  class StudyLoadWarning extends Error { constructor() { super('Heavy day'); this.days = [{ date: '2026-10-26', current_minutes: 0, added_minutes: 270, total_minutes: 270 }]; } }
  const data = { tasks: [task], subjects: [subject, { ...subject, id: 8, name: 'Chemistry' }], blocks: [], weekly: [], minutes: 0, ready: true, refreshing: false,
    refresh: async () => { refreshes++; } };
  const study = { data, today: '2026-10-20', clock: Date.parse('2026-10-20T11:00:00Z'), disabled: false, demoRevision: 0,
    refresh: data.refresh, openEntry: (...args) => actions.push(['entry', ...args]), openEditSubject: value => actions.push(['editSubject', value]), confirmDeleteSubject: value => actions.push(['deleteSubject', value]),
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
      const owner = slots;
      const i = cursor++;
      if (!owner[i] || !deps || deps.some((dep, j) => !Object.is(dep, owner[i].deps[j]))) {
        const previous = owner[i]; owner[i] = { deps };
        effects.push(() => { previous?.cleanup?.(); owner[i].cleanup = fn(); });
      }
    },
  };
  const theme = { useTheme: () => ({ colors: { text: dark ? '#F0F0F0' : '#1F1F1F', background: dark ? '#121412' : '#F8F6F2', accent: dark ? '#7CB58F' : '#2D5A41', muted: '#777777', bookInk: dark ? '#F0F0F0' : '#111111' }, isDark: dark, subjectColor: color => color }), useThemedStyles: () => ({ taskActionText: { color: '#000000' } }) };
  const controls = Object.fromEntries(['Button', 'FieldLabel', 'InfoButton', 'Input', 'Message', 'Pill', 'Sheet'].map(name => [name, name]));
  const modules = {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
      StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) }, AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion, addEventListener: () => ({ remove() {} }) },
      Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate({ outputRange }) { return this.value ? outputRange.at(-1) : outputRange[0]; } },
        timing: (value, config) => { const animation = { ...config, value, stopped: false }; return { start() { animations.push(animation); if (!holdAnimations) value.setValue(config.toValue); }, stop() { animation.stopped = true; } }; } } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-chart-kit': { LineChart: 'LineChart' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useScrollToTop() {}, useLocalSearchParams: () => ({ subjectId: routeSubjectId }), Redirect: 'Redirect', router: { navigate() {}, push: value => actions.push(['push', value]), canGoBack: () => true, back: () => actions.push(['back']) } },
    '../auth': { USE_REAL_AUTH: false },
    '../auth/SessionContext': { useSession: () => ({ user: { id: 'owner' }, signingOut: false, signOut() {} }) },
    '../ThemeContext': theme,
    '../db/SubjectService': { createSubject: async (...args) => { createdSubjects.push(args); if (failure) throw new Error('Disk error'); }, deleteSubject: async (...args) => { subjectDeletions.push(args); await gate; if (failure) throw new Error('Disk error'); }, updateSubject: async (...args) => { subjectUpdates.push(args); } },
    '../db/TaskService': { createTask: async () => { throw new Error('Unexpected task creation'); },
      updateTask: async (...args) => { updates.push(args); await gate; if (failure) throw new Error('Disk error'); },
      deleteTask: async (...args) => { deletions.push(args); await gate; if (failure) throw new Error('Disk error'); } },
    '../db/dateUtils': { getLocalDateKey: () => '2026-10-20', getLocalDayRange: () => ({ start: '2026-10-20T00:00:00Z', end: '2026-10-21T00:00:00Z' }) },
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
    '../components/StudyCards': Object.fromEntries(['CoachingCard', 'EmptyState', 'Feedback', 'FocusCard', 'ScreenHeader', 'TaskCard'].map(name => [name, name])),
    '../components/WeeklyProgressCard': { default: 'WeeklyProgressCard' }, '../components/FocusTimer': { default: 'FocusTimer' },
    '../components/SubjectBookshelf': { default: 'Bookshelf' },
    './theme': { formatTime() {}, formatMinutes() {} }, '../components/theme': { formatMinutes() {} }, '../utils/focusTimer': { formatElapsed() {} },
  };
  const context = vm.createContext({ Date, setInterval: () => 1, clearInterval() {} });
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file.replace(/\.js$/, '.jsx'), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async name => {
    if (name === '../utils/subjectFields' || name === '../utils/scheduling' || name.endsWith('/typography')) {
      const sourcePath = name.endsWith('/typography') ? 'components/typography.js' : name.slice(3) + '.js';
      const fields = new vm.SourceTextModule(fs.readFileSync(sourcePath, 'utf8'), { context });
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
  return { render, data, study, alerts, updates, createdSubjects, subjectUpdates, subjectDeletions, deletions, actions, schedules, animations, release: () => release?.(), route: value => { routeSubjectId = value; },
    setDark: value => { dark = value; }, finishAnimations: () => { for (const animation of animations) if (!animation.stopped) animation.value.setValue(animation.toValue); },
    fail: value => { failure = value; }, saved: () => saved, onSaved: () => { saved++; },
    refreshes: () => refreshes, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('weekly progress waits for layout, preserves zero days, resizes and supports point inspection in both themes', async () => {
  const s = await setup('components/WeeklyProgressCard.js');
  const days = Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${14 + index}`, minutes: index === 2 ? 45.5 : 0 }));
  const props = { days, ready: true };
  assert.equal(find(s.render(props), 'LineChart'), undefined);
  const measure = width => find(s.render(props), 'View', p => typeof p.onLayout === 'function').props.onLayout({ nativeEvent: { layout: { width } } });
  measure(278.5);
  let chart = find(s.render(props), 'LineChart').props;
  assert.equal(chart.width, 278);
  assert.deepEqual(JSON.parse(JSON.stringify(chart.data.datasets[0].data)), [0, 0, 45.5, 0, 0, 0, 0]);
  assert.equal(chart.data.labels.length, 7);
  assert.equal(chart.chartConfig.color(), '#2D5A41');
  assert.equal(chart.chartConfig.backgroundGradientFrom, '#F8F6F2');
  chart.onDataPointClick({ index: 2 });
  assert.ok(find(s.render(props), 'Text', p => typeof p.children === 'string' && /Oct 16.*45.5 min/.test(p.children)));
  measure(360); s.setDark(true);
  chart = find(s.render(props), 'LineChart').props;
  assert.equal(chart.width, 360); assert.equal(chart.chartConfig.color(), '#7CB58F');
  assert.equal(chart.chartConfig.backgroundGradientFrom, '#121412');
  props.days = days.map(day => ({ ...day, minutes: 0 }));
  chart = find(s.render(props), 'LineChart').props;
  assert.ok(chart.data.datasets[0].data.every(value => value === 0));
  assert.equal(chart.fromZero, true); assert.equal(chart.fromNumber, 1, 'an all-zero week retains a nonzero y-axis range');
  assert.ok(find(s.render(props), 'View', p => p.accessibilityLabel?.includes('0 minutes')));
});

test('weekly progress has loading/error feedback and Home renders it before Today\'s Focus', async () => {
  const s = await setup('components/WeeklyProgressCard.js');
  assert.ok(find(s.render({ days: [], ready: false }), 'ActivityIndicator'));
  assert.ok(find(s.render({ days: [], ready: false, error: 'Storage unavailable' }), 'Text', p => p.children === 'Progress unavailable. Pull to refresh.'));
  assert.equal(find(s.render({ days: [], ready: false }), 'LineChart'), undefined);
  const home = await setup('screens/HomeScreen.js');
  home.data.weekly = [{ date: '2026-10-20', minutes: 25 }];
  const header = find(home.render(), 'FlatList').props.ListHeaderComponent;
  assert.equal(find(header, 'WeeklyProgressCard').props.days, home.data.weekly);
  const sections = header.props.children.flat(Infinity);
  assert.ok(sections.findIndex(node => node?.type === 'WeeklyProgressCard') < sections.findIndex(node => find(node, 'Text', p => p.children === 'Today’s Focus')));
});

test('shared feedback keeps errors inline and never renders a success notice', async () => {
  const s = await setup('components/StudyCards.js');
  s.study.notice = 'Review saved.';
  assert.equal(find(s.render({}, 'Feedback'), 'Message'), undefined);
  s.study.error = 'Could not refresh study data.'; s.data.error = s.study.error;
  const feedback = s.render({}, 'Feedback');
  assert.equal(find(feedback, 'Message').props.text, s.study.error);
  assert.ok(find(feedback, 'Button', p => p.label === 'Try Refreshing'));
});

test('each identical workspace notice has a fresh identity and dismissal clears it', async () => {
  const s = await setup('components/StudyWorkspace.js');
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  render().setNotice('Review saved.'); const first = render().noticeId;
  render().setNotice('Review saved.');
  assert.equal(render().noticeId, first + 1); assert.equal(render().notice, 'Review saved.');
  render().dismissNotice(); assert.equal(render().notice, '');
});

test('task editor prefills both fields, saves once, and keeps failed drafts available', async () => {
  const s = await setup('components/EntrySheet.js', { failure: true });
  const props = { kind: 'task', userId: 'owner', subjects: s.data.subjects, editingTask: task, onSaved: s.onSaved, onClose() {}, onDeleted() {} };
  const render = () => s.render(props);
  assert.equal(render().props.title, 'Edit Task');
  const input = find(render(), 'Input'); assert.equal(input.props.value, task.title);
  assert.equal(find(render(), 'Pill', props => props.label === 'Biology').props.selected, true);
  input.props.onChangeText('New title'); find(render(), 'Pill', props => props.label === 'Chemistry').props.onPress();
  find(render(), 'Button', props => props.label === 'Save Changes').props.onPress(); await s.flush();
  assert.equal(s.saved(), 0); assert.equal(find(render(), 'Input').props.value, 'New title');
  assert.match(find(render(), 'Message').props.text, /draft is still here/);
  s.fail(false); find(render(), 'Button', props => props.label === 'Save Changes').props.onPress(); await s.flush();
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

test('Opened Book hides a missed badge for any future scheduled commitment and restores it when none remains', async () => {
  const s = await setup('screens/OpenedBookScreen.js');
  const renderTask = row => {
    s.data.tasks = [row];
    const list = find(s.render(), 'FlatList');
    return find(list.props.renderItem({ item: row }), 'TaskCard').props;
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
  assert.equal(find(render(), 'Input', p => p.label === 'Subject Code').props.value, 'BIO-101');
  find(render(), 'Input', p => p.label === 'Subject Code').props.onChangeText(' bio-201 ');
  find(render(), 'Button', p => p.label === 'Save Changes').props.onPress(); await s.flush();
  assert.equal(s.subjectUpdates[0][2].subject_code, 'BIO-201'); assert.equal(s.saved(), 1);
});

test('spines reveal covers without navigation; covers open notebooks, edit separately, and return to the shelf', async () => {
  const s = await setup('components/SubjectBookshelf.js');
  const opened = [], edits = [];
  const props = { subjects: [subject], taskCounts: new Map([[7, 3]]), onOpen: value => opened.push(value), onEdit: value => edits.push(value), onAddField() {} };
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
  assert.equal(opened.length, 0);
  book = renderBook();
  assert.ok(find(book, 'Text', p => p.children === subject.name));
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Edit ')).props.onPress();
  assert.deepEqual(edits, [subject]); assert.equal(opened.length, 0);
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Open ')).props.onPress();
  assert.deepEqual(opened, [subject]);
  assert.ok(s.animations.some(config => config.toValue === 1));
  find(book, 'Pressable', p => p.accessibilityLabel.startsWith('Close ')).props.onPress();
  assert.ok(find(renderBook(), 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')));
  assert.equal(find(s.render(props), 'Pressable', p => p.accessibilityLabel === 'Show All Tasks'), undefined);
});

test('duration edits calculate End, moving Start preserves duration, and manual End takes precedence', async () => {
  const s = await setup('components/ScheduleSheet.js');
  const props = { userId: 'owner', task, onClose() {}, onSaved: s.onSaved };
  const render = () => s.render(props);
  const duration = () => find(render(), 'Input', p => p.label === 'Duration (Optional)');
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
  assert.equal(find(render(), 'Button', p => p.label === 'Save Session').props.disabled, true);
  duration().props.onSubmitEditing(); await s.flush(); assert.equal(s.schedules.length, 0);
  duration().props.onChangeText('45m');
  find(render(), 'Button', p => p.label === 'Save Session').props.onPress(); await s.flush();
  assert.equal(s.saved(), 1);
  assert.equal((Date.parse(s.schedules[0][1].end_time) - Date.parse(s.schedules[0][1].start_time)) / 60000, 45);
});

test('duration-based scheduling retains the workload confirmation and reschedule options', async () => {
  const s = await setup('components/ScheduleSheet.js', { warn: true });
  const props = { userId: 'owner', task, onClose() {}, onSaved: s.onSaved };
  const render = () => s.render(props);
  find(render(), 'Input').props.onChangeText('4h 30m');
  find(render(), 'Button', p => p.label === 'Save Session').props.onPress(); await s.flush();
  assert.equal(s.saved(), 0); assert.ok(find(render(), 'Button', p => p.label === 'Schedule Anyway'));
  find(render(), 'Button', p => p.label === 'Schedule Anyway').props.onPress(); await s.flush();
  assert.equal(s.saved(), 1); assert.equal(s.schedules[1][2].allowHeavyDay, true);
  assert.equal(s.schedules[0][1].start_time, s.schedules[1][1].start_time);
  assert.equal(s.schedules[0][1].end_time, s.schedules[1][1].end_time);
  const r = await setup('components/ScheduleSheet.js');
  const reschedule = () => r.render({ ...props, sourceBlock: { id: 4 }, onSaved: r.onSaved });
  find(reschedule(), 'Input').props.onChangeText('2h');
  find(reschedule(), 'Button', p => p.label === 'Reschedule Session ↗').props.onPress(); await r.flush();
  assert.equal(r.schedules[0][1], 4);
  assert.equal((Date.parse(r.schedules[0][3].end_time) - Date.parse(r.schedules[0][3].start_time)) / 60000, 120);
});

test('Library only renders the shelf and opens a dedicated book route', async () => {
  const s = await setup('screens/LibraryScreen.js');
  const tree = s.render();
  assert.equal(find(tree, 'FlatList'), undefined); assert.equal(find(tree, 'TaskCard'), undefined);
  assert.equal(find(tree, 'Button', p => p.label.includes('New Task')), undefined);
  find(tree, 'Bookshelf').props.onOpen(subject);
  assert.equal(s.actions[0][0], 'push');
  assert.equal(s.actions[0][1].pathname, '/library/[subjectId]');
  assert.equal(s.actions[0][1].params.subjectId, '7');
  find(tree, 'Button', p => p.label === 'Add Subject').props.onPress();
  assert.deepEqual(s.actions.at(-1), ['entry', 'subject']);
});

test('Opened Book scopes tasks, prefills New Task, supports book actions and redirects stale/unowned IDs', async () => {
  const s = await setup('screens/OpenedBookScreen.js');
  s.data.tasks = [task, { ...task, id: 10, subject_id: 8 }];
  const renderList = () => find(s.render(), 'FlatList');
  let list = renderList();
  assert.deepEqual(list.props.data, [task]);
  assert.equal(list.props.renderItem({ item: task }).props.children[1].props.notebook, true);
  const header = list.props.ListHeaderComponent;
  find(header, 'Button', p => p.label === 'New Task').props.onPress();
  assert.deepEqual(s.actions.at(-1), ['entry', 'task', 7]);
  find(header, 'Button', p => p.label === 'Edit Book').props.onPress();
  assert.deepEqual(s.actions.at(-1), ['editSubject', subject]);
  find(header, 'Button', p => p.label === 'Delete Book').props.onPress();
  assert.deepEqual(s.actions.at(-1), ['deleteSubject', subject]);
  s.route('9999'); assert.equal(s.render().type, 'Redirect');
  s.route(['7', '8']); assert.equal(s.render().type, 'Redirect');
  s.route('7'); s.data.subjects = []; assert.equal(s.render().props.href, '/library');
});

test('subject create/edit saves are quiet; major backup feedback remains visible', async () => {
  const s = await setup('components/StudyWorkspace.js');
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  render().openEntry('subject'); render().savedEntry();
  assert.equal(render().notice, ''); assert.equal(s.refreshes(), 1);
  render().openEditSubject(subject); render().savedEntry();
  assert.equal(render().notice, ''); assert.equal(s.refreshes(), 2);
  await render().manageBackup('export');
  assert.match(render().notice, /Backup prepared/);
});

test('Opened Book deletion uses native confirmation, locks competing actions and refreshes shared data', async () => {
  const s = await setup('components/StudyWorkspace.js', { hold: true });
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  render().confirmDeleteSubject(subject);
  assert.equal(s.alerts[0][0], 'Delete Subject');
  s.alerts[0][2][0].onPress(); assert.equal(s.subjectDeletions.length, 0);
  render().confirmDeleteSubject(subject);
  s.alerts[1][2][1].onPress(); s.alerts[1][2][1].onPress();
  render().openEditSubject(subject); assert.equal(render().entry, null);
  assert.deepEqual(s.subjectDeletions, [['owner', 7]]);
  assert.equal(render().deletingSubject, 7);
  s.release(); await s.flush();
  assert.equal(s.refreshes(), 1); assert.equal(render().notice, 'Subject deleted.');
});

test('book covers remain mounted while closing, reverse an interrupted transition and honor reduced motion', async () => {
  for (const reduced of [false, true]) {
    const s = await setup('components/SubjectBookshelf.js', { holdAnimations: true, reduceMotion: reduced });
    const props = { subjects: [subject], taskCounts: new Map(), onOpen() {}, onEdit() {}, onAddField() {} };
    const renderBook = () => {
      const element = find(s.render(props), 'ScrollView').props.children[0];
      return s.render(element.props, element.type);
    };
    renderBook(); await s.flush();
    find(renderBook(), 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')).props.onPress();
    let tree = renderBook(); s.finishAnimations();
    assert.ok(find(tree, 'Text', p => p.children === subject.name));
    const openValue = s.animations.at(-1)?.value;
    find(tree, 'Pressable', p => p.accessibilityLabel.startsWith('Close ')).props.onPress();
    tree = renderBook();
    assert.equal(find(tree, 'Pressable', p => p.accessibilityLabel.startsWith('Open ')), undefined, 'hidden cover controls are inaccessible while returning');
    assert.ok(find(tree, 'Pressable', p => p.accessibilityLabel.startsWith('Open '), true), 'the actual cover stays mounted until the reverse animation ends');
    assert.ok(find(tree, 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')));
    if (!reduced) {
      const closing = s.animations.at(-1);
      assert.equal(closing.toValue, 0); assert.equal(closing.value, openValue);
      assert.equal(closing.value.value, 1, 'close has not snapped to a spine before animation completion');
      find(tree, 'Pressable', p => p.accessibilityLabel.startsWith('Reveal ')).props.onPress();
      renderBook(); assert.equal(closing.stopped, true); assert.equal(s.animations.at(-1).toValue, 1);
      s.finishAnimations(); assert.equal(openValue.value, 1);
    } else assert.equal(s.animations.length, 0, 'reduce motion uses direct state changes in both directions');
  }
});

test('dark books use muted gradients without changing saved colors; shelf add uses the shelf field', async () => {
  const s = await setup('components/SubjectBookshelf.js');
  const fields = [];
  const props = { subjects: [subject], taskCounts: new Map(), onOpen() {}, onEdit() {}, onAddField: field => fields.push(field) };
  const shelf = () => s.render(props);
  const renderBook = () => { const element = find(shelf(), 'ScrollView').props.children[0]; return s.render(element.props, element.type); };
  const stored = subject.field_colors;
  const light = find(renderBook(), 'Gradient').props.colors;
  s.setDark(true);
  const dark = find(renderBook(), 'Gradient').props.colors;
  const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  for (let i = 0; i < 2; i++) assert.ok(luminance(dark[i]) < luminance(light[i]));
  assert.equal(subject.field_colors, stored);
  s.setDark(false); assert.deepEqual(find(renderBook(), 'Gradient').props.colors, light);
  find(shelf(), 'Pressable', p => p.accessibilityLabel === 'Add Subject to Sciences').props.onPress();
  assert.deepEqual(fields, ['Sciences']);
  props.disabled = true;
  assert.equal(find(shelf(), 'Pressable', p => p.accessibilityLabel === 'Add Subject to Sciences').props.disabled, true);
});

test('shelf add routes a field-prefilled draft through the shared workspace and resets it for other forms', async () => {
  const library = await setup('screens/LibraryScreen.js');
  find(library.render(), 'Bookshelf').props.onAddField('Computer Science');
  assert.deepEqual(library.actions.at(-1), ['entry', 'subject', null, 'Computer Science']);
  const s = await setup('components/StudyWorkspace.js');
  const tree = () => s.render({ children: 'screen' }, 'StudyWorkspace');
  const state = () => tree().props.value;
  state().openEntry('subject', null, 'Computer Science');
  assert.equal(find(tree(), 'EntrySheet').props.initialField, 'Computer Science');
  state().savedEntry(); state();
  state().openEntry('subject'); assert.equal(state().initialField, '');
  state().savedEntry(); state();
  state().openEditSubject(subject); assert.equal(state().initialField, '');
});

test('field dropdown deduplicates existing names, filters suggestions, and saves both existing and new fields', async () => {
  const s = await setup('components/EntrySheet.js');
  s.data.subjects = [subject, { ...subject, id: 8, field_of_study: ' sciences ' }, { ...subject, id: 9, field_of_study: 'Humanities' }];
  const props = { kind: 'subject', userId: 'owner', subjects: s.data.subjects, initialField: 'Computer Science', onSaved: s.onSaved, onClose() {}, onDeleted() {} };
  const render = () => s.render(props);
  const field = () => find(render(), 'Input', p => p.label === 'Field of Study');
  assert.equal(field().props.value, 'Computer Science');
  find(render(), 'Pressable', p => p.accessibilityLabel === 'Choose Field of Study').props.onPress();
  const options = find(render(), 'ScrollView').props.children[0].map(item => item.props.accessibilityLabel);
  assert.deepEqual(Array.from(options), ['Use field Humanities', 'Use field Sciences']);
  field().props.onChangeText('sci');
  assert.equal(find(render(), 'Pressable', p => p.accessibilityLabel === 'Use field Humanities'), undefined);
  find(render(), 'Pressable', p => p.accessibilityLabel === 'Use field Sciences').props.onPress();
  assert.equal(field().props.value, 'Sciences'); assert.equal(find(render(), 'ScrollView'), undefined);
  find(render(), 'Input', p => p.label === 'Subject Name').props.onChangeText('Physics');
  find(render(), 'Button', p => p.label.startsWith('Create Subject')).props.onPress(); await s.flush();
  assert.equal(s.createdSubjects[0][1].field_of_study, 'Sciences');
  field().props.onChangeText('Engineering, Design');
  find(render(), 'Pressable', p => p.accessibilityLabel === 'Use new field Engineering, Design').props.onPress();
  s.fail(true); find(render(), 'Button', p => p.label.startsWith('Create Subject')).props.onPress(); await s.flush();
  assert.equal(field().props.value, 'Engineering, Design'); assert.equal(s.saved(), 1, 'failed saves retain the field draft');
  s.fail(false); find(render(), 'Button', p => p.label.startsWith('Create Subject')).props.onPress(); await s.flush();
  assert.equal(s.createdSubjects.at(-1)[1].field_of_study, 'Engineering, Design'); assert.equal(s.saved(), 2);
});
