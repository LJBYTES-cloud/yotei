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
async function setup(file, { failure = false, hold = false, warn = false, dark = false, reduceMotion = false, holdAnimations = false, platform = 'ios', realAuth = true,
  pickedFile = { uri: 'file:///documents/materials/user-owner/notes.pdf', name: 'Notes.pdf', copied: true } } = {}) {
  let slots = [];
  const instances = new Map(), memoized = new Set(), alerts = [], updates = [], createdSubjects = [], subjectUpdates = [], subjectDeletions = [], deletions = [], actions = [], schedules = [], animations = [];
  let routeSubjectId = '7';
  let cursor = 0, effects = [], refreshes = 0, saved = 0, release;
  const gate = hold ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  class StudyLoadWarning extends Error { constructor() { super('Heavy day'); this.days = [{ date: '2026-10-26', current_minutes: 0, added_minutes: 270, total_minutes: 270 }]; } }
  const data = { tasks: [task], subjects: [subject, { ...subject, id: 8, name: 'Chemistry' }], blocks: [], materials: [], journal: [], reflections: [], daySessions: [], weekly: [], minutes: 0, ready: true, refreshing: false,
    refresh: async () => { refreshes++; } };
  const study = { data, user: { id: 'owner', name: 'Alex', email: 'alex@example.com' }, refreshInBackground() {}, today: '2026-10-20', clock: Date.parse('2026-10-20T11:00:00Z'), disabled: false, demoRevision: 0,
    refresh: data.refresh, openEntry: (...args) => actions.push(['entry', ...args]), openEditSubject: value => actions.push(['editSubject', value]), confirmDeleteSubject: value => actions.push(['deleteSubject', value]),
    openEditTask: value => actions.push(['edit', value]), confirmDeleteTask: value => actions.push(['delete', value]),
    openSchedule: value => actions.push(['schedule', value]), openJournalDetail: value => actions.push(['openJournal', value]),
    markDone: value => actions.push(['markDone', value]), confirmDeleteBlock: value => actions.push(['deleteBlock', value]) };
  const time = { is24Hour: true, set24Hour: value => { time.is24Hour = value; } };
  const hooks = {
    memo: component => { memoized.add(component); return component; },
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
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'RefreshControl', 'ScrollView', 'SectionList', 'KeyboardAvoidingView', 'Modal', 'Switch', 'Text', 'View'].map(name => [name, name])),
      BackHandler: { addEventListener: () => ({ remove() {} }) }, StyleSheet: { create: value => value }, Platform: { OS: platform }, Linking: { openURL: async value => { actions.push(['openURL', value]); if (failure) throw new Error('Unavailable'); } }, Alert: { alert: (...args) => alerts.push(args) }, AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion, addEventListener: () => ({ remove() {} }) },
      Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate({ outputRange }) { return this.value ? outputRange.at(-1) : outputRange[0]; } },
        timing: (value, config) => { const animation = { ...config, value, stopped: false }; return { start() { animations.push(animation); if (!holdAnimations) value.setValue(config.toValue); }, stop() { animation.stopped = true; } }; } } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@react-native-community/datetimepicker': { default: 'NativePicker', DateTimePickerAndroid: { open: options => actions.push(['picker', options]), dismiss: async () => {} } },
    'react-native-chart-kit': { LineChart: 'LineChart' }, 'react-native-svg': { Circle: 'Circle' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider' },
    'expo-router': { useFocusEffect: cb => hooks.useEffect(cb, [cb]), useScrollToTop() {}, useLocalSearchParams: () => ({ subjectId: routeSubjectId, entryId: routeSubjectId }), Redirect: 'Redirect', Stack: { Screen: 'StackScreen' }, router: { navigate: value => actions.push(['navigate', value]), push: value => actions.push(['push', value]), canGoBack: () => true, back: () => actions.push(['back']), replace: value => actions.push(['replace', value]) } },
    '../auth': { USE_REAL_AUTH: realAuth },
    '../auth/SessionContext': { useSession: () => ({ user: study.user, signingOut: false, signOut() {}, updatingName: false,
      updateName: async name => { actions.push(['name', name]); study.user = { ...study.user, name }; } }) },
    './index': { authService: { getCurrentUser: async () => study.user,
      updateName: async name => { actions.push(['nameAdapter', name]); await gate; if (failure) throw new Error('Name unavailable'); return { ...study.user, name }; },
      signOut: async () => { actions.push(['signOut']); } } },
    '../TimeFormatContext': { useTimeFormat: () => time },
    '../ThemeContext': theme,
    '../db/SubjectService': { createSubject: async (...args) => { createdSubjects.push(args); if (failure) throw new Error('Disk error'); }, deleteSubject: async (...args) => { subjectDeletions.push(args); await gate; if (failure) throw new Error('Disk error'); }, updateSubject: async (...args) => { subjectUpdates.push(args); } },
    '../db/TaskService': { createTask: async () => { throw new Error('Unexpected task creation'); },
      updateTask: async (...args) => { updates.push(args); await gate; if (failure) throw new Error('Disk error'); },
      deleteTask: async (...args) => { deletions.push(args); await gate; if (failure) throw new Error('Disk error'); } },
    '../db/dateUtils': { getLocalDateKey: () => '2026-10-20', getLocalDayRange: () => ({ start: '2026-10-20T00:00:00Z', end: '2026-10-21T00:00:00Z' }) },
    '../db/StudyBlockService': { finishStudyBlock: async (_user, id) => ({ id, subject_id: 7, subject_name: 'Biology', task_title: 'Read cells', status: 'done', actual_study_seconds: 600 }),
      pauseStudyBlock: async (...args) => actions.push(['timer-break', ...args]), resumeStudyBlock: async (...args) => actions.push(['timer-resume', ...args]), startStudyBlock: async (...args) => actions.push(['timer-start', ...args]),
      markStudyBlockDone: async (user, id) => { actions.push(['markDone', user, id]); await gate; if (failure) throw new Error('Disk error'); return { id, status: 'done', actual_start_time: null, actual_end_time: new Date().toISOString(), actual_study_seconds: 1800 }; },
      deleteStudyBlock: async (...args) => { actions.push(['deleteBlock', ...args]); await gate; if (failure) throw new Error('Disk error'); },
      createStudyBlock: async (...args) => { schedules.push(args); if (warn && !args[2]?.allowHeavyDay) throw new StudyLoadWarning(); return { id: 27, ...args[1] }; },
      rescheduleStudyBlock: async (...args) => { schedules.push(args); return { id: 28, ...args[3] }; } },
    '../db/StudyLoadService': { StudyLoadWarning },
    '../db/seedData': { seedDemoData: async user => actions.push(['seed', user]) },
    '../db/JournalService': { createJournalEntry: async (...args) => { actions.push(['journal', ...args]); await gate; if (failure) throw new Error('Disk error'); },
      updateJournalEntry: async (...args) => { actions.push(['editJournal', ...args]); await gate; if (failure) throw new Error('Disk error'); },
      deleteJournalEntry: async (...args) => { actions.push(['deleteJournal', ...args]); await gate; if (failure) throw new Error('Disk error'); } },
    '../utils/materialFiles': { pickMaterialFile: async () => { actions.push(['pick']); return pickedFile; }, discardMaterialFile: async (...args) => actions.push(['discard', ...args]) },
    '../db/ReflectionService': { createReflectionItem: async (...args) => { actions.push(['reflection', ...args]); await gate; if (failure) throw new Error('Disk error'); } },
    '../db/MaterialService': { createMaterial: async (...args) => { actions.push(['createMaterial', ...args]); if (failure) throw new Error('Disk error'); }, updateMaterial: async (...args) => { actions.push(['updateMaterial', ...args]); if (failure) throw new Error('Disk error'); }, deleteMaterial: async (...args) => { actions.push(['deleteMaterial', ...args]); } },
    '../db/ProgressService': { getStudyDayDetails: async (...args) => { actions.push(['day', ...args]); if (failure) throw new Error('Read failed'); return data.daySessions; } },
    '../db/BackupService': { exportBackup() {}, importBackup() {} },
    '../hooks/useDashboardData': { useDashboardData: () => data },
    './EntrySheet': { default: 'EntrySheet' }, './ScheduleSheet': { default: 'ScheduleSheet' }, './CompletionReflectionSheet': { default: 'CompletionReflectionSheet' }, './MaterialSheet': { default: 'MaterialSheet' }, './ProgressDetailsModal': { default: 'ProgressDetailsModal' }, './InfoModal': { default: 'InfoModal' }, '../components/StudyMaterials': { default: 'StudyMaterials' },
    './DateTimeField': { default: 'DateTimeField' }, './ItemActionsMenu': { default: 'ItemActionsMenu' }, './JournalEntrySheet': { default: 'JournalEntrySheet' },
    '../components/JournalEntryContent': { default: 'JournalEntryContent' }, '../components/DisplayNameSheet': { default: 'DisplayNameSheet' },
    './BlockDeletionModal': { default: 'BlockDeletionModal' },
    './BrandLogo': { default: 'BrandLogo' }, '../components/BrandLogo': { default: 'BrandLogo' },
    './StudyWorkspace': { useStudy: () => study, useStudyList: () => study }, '../components/StudyWorkspace': { useStudy: () => study, useStudyList: () => study },
    '../hooks/useScreenClock': { useScreenClock: () => study.clock },
    './ui': controls, '../components/ui': controls,
    './studyStyles': { createStudyStyles() {} }, '../components/studyStyles': { createStudyStyles() {} },
    '../components/StudyCards': Object.fromEntries(['CoachingCard', 'EmptyState', 'Feedback', 'FocusCard', 'ScreenHeader', 'TaskCard'].map(name => [name, name])),
    '../components/WeeklyProgressCard': { default: 'WeeklyProgressCard' }, '../components/FocusTimer': { default: 'FocusTimer' }, '../components/CoachCard': { default: 'CoachCard' },
    '../components/SubjectBookshelf': { default: 'Bookshelf' },
    './theme': { formatTime() {}, formatMinutes() {} }, '../components/theme': { formatMinutes() {} }, '../utils/focusTimer': { formatElapsed() {} },
  };
  const context = vm.createContext({ Date, URL, requestAnimationFrame: callback => setImmediate(callback), cancelAnimationFrame: handle => clearImmediate(handle), setInterval: () => 1, clearInterval() {} });
  const timeHelpers = new vm.SourceTextModule(fs.readFileSync('utils/timeFormat.js', 'utf8'), { context });
  await timeHelpers.link(() => { throw new Error('Unexpected time helper import'); }); await timeHelpers.evaluate();
  time.formatTime = value => timeHelpers.namespace.formatTime(value, time.is24Hour);
  time.formatDateTime = value => timeHelpers.namespace.formatDateTime(value, time.is24Hour);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file.replace(/\.js$/, '.jsx'), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async name => {
    if (['../utils/subjectFields', '../utils/scheduling', '../utils/materialLinks', '../utils/focusTimer', '../utils/coaching', '../utils/progressChart'].includes(name) || name.endsWith('/typography')) {
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
  return { render, data, study, time, memoized, alerts, updates, createdSubjects, subjectUpdates, subjectDeletions, deletions, actions, schedules, animations, release: () => release?.(), route: value => { routeSubjectId = value; },
    setDark: value => { dark = value; }, finishAnimations: () => { for (const animation of animations) if (!animation.stopped) animation.value.setValue(animation.toValue); },
    fail: value => { failure = value; }, saved: () => saved, onSaved: () => { saved++; },
    unmount: () => { for (const instance of instances.values()) for (const hook of instance) hook?.cleanup?.(); },
    refreshes: () => refreshes, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('weekly progress waits for layout, preserves zero days, resizes and supports point inspection in both themes', async () => {
  const s = await setup('components/WeeklyProgressCard.js');
  const days = Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${14 + index}`, minutes: index === 2 ? 45.5 : 0 }));
  const props = { userId: 'owner', days, ready: true };
  assert.equal(find(s.render(props), 'LineChart'), undefined);
  const measure = width => find(s.render(props), 'View', p => typeof p.onLayout === 'function').props.onLayout({ nativeEvent: { layout: { width } } });
  measure(278.5);
  let chart = find(s.render(props), 'LineChart').props;
  assert.equal(chart.width, 278);
  assert.equal(chart.bezier, true); assert.equal(chart.withShadow, true);
  assert.equal(chart.chartConfig.fillShadowGradientFromOpacity, 0.12);
  assert.equal(chart.chartConfig.fillShadowGradientToOpacity, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(chart.data.datasets[0].data)), [0, 0, 45.5, 0, 0, 0, 0]);
  assert.equal(chart.data.labels.length, 7);
  assert.equal(chart.chartConfig.color(), '#2D5A41');
  assert.equal(chart.chartConfig.backgroundGradientFrom, '#F8F6F2');
  chart.onDataPointClick({ index: 2 });
  assert.equal(find(s.render(props), 'ProgressDetailsModal').props.selection, '2026-10-16');
  const background = () => find(s.render(props), 'Pressable', p => p.accessibilityLabel?.startsWith('Open Weekly Summary'));
  background().props.onPress();
  assert.equal(find(s.render(props), 'ProgressDetailsModal').props.selection, '2026-10-16', 'a point tap must not bubble into the weekly summary');
  const target = chart.renderDotContent({ x: 70, y: 20, index: 4 });
  assert.ok(target.props.r >= 22, 'the transparent target is at least 44 pixels wide');
  target.props.onPressIn(); background().props.onPress();
  assert.equal(find(s.render(props), 'ProgressDetailsModal').props.selection, '2026-10-18');
  background().props.onStartShouldSetResponderCapture(); background().props.onPress();
  assert.equal(find(s.render(props), 'ProgressDetailsModal').props.selection, 'week');
  measure(360); s.setDark(true);
  chart = find(s.render(props), 'LineChart').props;
  assert.equal(chart.width, 360); assert.equal(chart.chartConfig.color(), '#7CB58F');
  assert.equal(chart.chartConfig.backgroundGradientFrom, '#121412');
  props.days = days.map(day => ({ ...day, minutes: 0 }));
  chart = find(s.render(props), 'LineChart').props;
  assert.ok(chart.data.datasets[0].data.every(value => value === 0));
  assert.equal(chart.fromZero, true); assert.equal(chart.fromNumber, 60, 'an all-zero week retains a whole-hour range');
  assert.equal(chart.segments, 1); assert.equal(chart.formatYLabel('60'), '1h');
  assert.ok(find(s.render(props), 'Pressable', p => p.accessibilityLabel?.includes('0 minutes')));
});

test('progress detail dialogs show week aggregates, actual/break allocation, overruns and read errors', async () => {
  const s = await setup('components/ProgressDetailsModal.js');
  const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${14 + i}`, minutes: i === 6 ? 70 : 0 }));
  const props = { userId: 'owner', days, selection: 'week', onDay() {}, onClose() {} };
  assert.equal(s.render(props).props.title, 'Weekly Summary');
  assert.ok(find(s.render(props), 'Text', p => p.children === '10 min'), 'average includes all seven dates');
  s.data.daySessions = [{ id: 1, task_title: 'Read cells', subject_name: 'Biology', actual_start_time: '2026-10-20T10:00:00Z', studied_minutes: 25, planned_minutes: 30, break_minutes: 2, elapsed_minutes: 27, overrun_minutes: 0, finished_late_minutes: 10 }];
  props.selection = '2026-10-20'; s.render(props); await s.flush();
  assert.ok(find(s.render(props), 'Text', p => p.children === 'Read cells'));
  assert.deepEqual(s.actions, [['day', 'owner', '2026-10-20']]);
  assert.ok(find(s.render(props), 'Text', p => Array.isArray(p.children) && p.children.some(part => typeof part === 'string' && part.includes('After Scheduled End'))));
  const failure = await setup('components/ProgressDetailsModal.js', { failure: true });
  failure.render(props); await failure.flush();
  assert.ok(find(failure.render(props), 'Text', p => p.accessibilityRole === 'alert'));
});

test('material sheets preserve failed drafts, save edits and open links through the OS with recoverable errors', async () => {
  const s = await setup('components/MaterialSheet.js', { failure: true });
  const material = { id: 6, subject_id: 7, title: 'Notes', url_or_note: 'https://example.com' };
  const props = { userId: 'owner', subjectId: 7, material, onClose() {}, onSaved: s.onSaved };
  find(s.render(props), 'Input', p => p.label === 'Title').props.onChangeText('Lecture Notes');
  find(s.render(props), 'Button', p => p.label === 'Save Material').props.onPress(); await s.flush();
  assert.equal(s.saved(), 0); assert.equal(find(s.render(props), 'Input', p => p.label === 'Title').props.value, 'Lecture Notes');
  s.fail(false); find(s.render(props), 'Button', p => p.label === 'Save Material').props.onPress(); await s.flush();
  assert.equal(s.saved(), 1); assert.equal(s.actions.at(-1)[0], 'updateMaterial');
  const links = await setup('components/StudyMaterials.js', { failure: true });
  links.data.materials = [material]; links.study.openMaterial = (...args) => links.actions.push(['edit', ...args]); links.study.confirmDeleteMaterial = value => links.actions.push(['delete', value]);
  const render = () => links.render({ subjectId: 7 });
  find(render(), 'Pressable', p => p.accessibilityRole === 'link').props.onPress(); await links.flush();
  assert.deepEqual(links.actions[0], ['openURL', 'https://example.com']);
  assert.match(find(render(), 'Message').props.text, /could not be opened/);
  links.fail(false); find(render(), 'Pressable', p => p.accessibilityRole === 'link').props.onPress(); await links.flush();
  assert.equal(find(render(), 'Message').props.text, '');
  find(render(), 'ItemActionsMenu').props.onEdit(); find(render(), 'ItemActionsMenu').props.onDelete();
  assert.deepEqual(links.actions.slice(-2), [['edit', 7, material], ['delete', material]]);
});

test('mock demo loading and completion create a linked reflection once', async () => {
  const s = await setup('components/StudyWorkspace.js', { realAuth: false });
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  await render().loadDemoData();
  assert.deepEqual(s.actions[0], ['seed', 'owner']); assert.equal(render().demoRevision, 1);
  await render().complete(27);
  assert.equal(render().reflectionPrompt.id, 27);
  await render().addCompletedReflection('I can now explain the stages.');
  assert.equal(render().reflectionPrompt, null); assert.equal(render().notice, 'Reflection saved.');
  assert.deepEqual(JSON.parse(JSON.stringify(s.actions.find(action => action[0] === 'reflection'))), ['reflection', 'owner', { subject_id: 7, study_block_id: 27, note: 'I can now explain the stages.' }]);
});

test('Journal renders a unified feed and opens the manual entry sheet', async () => {
  const s = await setup('screens/JournalScreen.js'); let opened = 0;
  s.study.openJournalEntry = () => { opened++; };
  s.data.journal = [{ id: 'entry-1', kind: 'entry', title: 'Plan', content: 'Next steps', created_at: '2026-10-21T10:00:00Z' },
    { id: 'reflection-1', kind: 'reflection', title: 'Cells', content: 'Learned the stages', created_at: '2026-10-20T10:00:00Z' }];
  const list = find(s.render(), 'FlatList');
  assert.equal(list.props.data, s.data.journal);
  assert.equal(list.props.keyExtractor(s.data.journal[0]), 'entry-1');
  find(list.props.ListHeaderComponent, 'Button', p => p.label === 'New Entry').props.onPress(); assert.equal(opened, 1);
  for (const [index, label] of ['Journal Entry', 'Session Reflection'].entries()) {
    const row = list.props.renderItem({ item: s.data.journal[index] });
    assert.ok(s.memoized.has(row.type));
    assert.ok(find(s.render(row.props, row.type), 'Text', p => p.children === label));
    find(s.render(row.props, row.type), 'Pressable').props.onPress();
    assert.equal(s.actions.at(-1)[0], 'openJournal'); assert.equal(s.actions.at(-1)[1], s.data.journal[index]);
  }
});

test('item actions wait for modal dismissal before editing and expose no inline task action buttons', async () => {
  const s = await setup('components/ItemActionsMenu.js'); let edited = 0, deleted = 0;
  const props = { label: 'Read Cells', onEdit: () => { edited++; }, onDelete: () => { deleted++; } };
  const render = () => s.render(props);
  assert.equal(find(render(), 'Modal'), undefined);
  find(render(), 'Pressable').props.onPress();
  find(render(), 'Button', p => p.label === 'Edit').props.onPress();
  assert.equal(edited, 0); assert.equal(find(render(), 'Modal').props.visible, false);
  find(render(), 'Modal').props.onDismiss(); assert.equal(edited, 1);
  find(render(), 'Pressable').props.onPress();
  find(render(), 'Button', p => p.label === 'Delete').props.onPress();
  find(render(), 'Modal').props.onDismiss(); assert.equal(deleted, 1);
  const card = await setup('components/StudyCards.js');
  const tree = card.render({ task }, 'TaskCard');
  assert.ok(find(tree, 'ItemActionsMenu'));
  assert.equal(find(tree, 'Text', p => p.children === 'Edit' || p.children === 'Delete'), undefined);
  const android = await setup('components/ItemActionsMenu.js', { platform: 'android' });
  find(android.render(props), 'Pressable').props.onPress();
  find(android.render(props), 'Button', p => p.label === 'Edit').props.onPress();
  android.render(props); await android.flush();
  assert.equal(edited, 2, 'Android finishes after commit without relying on onDismiss');
});

test('custom menu options and labels preserve dismissal ordering and invoke each action once', async () => {
  const s = await setup('components/ItemActionsMenu.js'); const calls = [];
  const props = { label: 'Cells', actions: [{ label: 'Mark as Done', onPress: () => calls.push('done') }, { label: 'Delete Block', tone: 'danger', onPress: () => calls.push('delete') }] };
  const render = () => s.render(props);
  find(render(), 'Pressable').props.onPress();
  assert.equal(find(render(), 'Button', p => p.label === 'Edit'), undefined);
  const done = find(render(), 'Button', p => p.label === 'Mark as Done').props.onPress;
  done(); done(); assert.deepEqual(calls, []);
  find(render(), 'Modal').props.onDismiss(); assert.deepEqual(calls, ['done']);
  find(render(), 'Pressable').props.onPress();
  find(render(), 'Button', p => p.label === 'Delete Block').props.onPress();
  assert.deepEqual(calls, ['done'], 'the delete confirmation must wait until the menu is dismissed');
  find(render(), 'Modal').props.onDismiss(); assert.deepEqual(calls, ['done', 'delete']);
  const legacy = await setup('components/ItemActionsMenu.js');
  const labels = { label: 'Cells', editLabel: 'Complete', onEdit: () => calls.push('complete') };
  find(legacy.render(labels), 'Pressable').props.onPress();
  assert.ok(find(legacy.render(labels), 'Button', p => p.label === 'Complete'));
  assert.equal(find(legacy.render(labels), 'Button', p => p.label === 'Delete'), undefined);
});

test('starting with an active or paused session shows the exact toast without touching SQLite, while break/resume still work', async () => {
  const s = await setup('components/StudyWorkspace.js');
  const state = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  for (const break_started_at of [null, '2026-10-20T10:15:00Z']) {
    s.data.blocks = [{ id: 7, status: 'active', break_started_at }];
    await state().controlTimer(12, 'start');
    assert.equal(state().notice, 'You already have a session in progress. Finish it before starting a new one.');
    assert.equal(state().workingBlock, null); assert.equal(s.refreshes(), 0); assert.equal(s.actions.length, 0);
  }
  await state().controlTimer(7, 'break'); assert.deepEqual(s.actions.at(-1), ['timer-break', 'owner', 7]);
  await state().controlTimer(7, 'resume'); assert.deepEqual(s.actions.at(-1), ['timer-resume', 'owner', 7]);
  s.data.blocks = [{ id: 12, status: 'scheduled' }];
  await state().controlTimer(12, 'start'); assert.deepEqual(s.actions.at(-1), ['timer-start', 'owner', 12]);
});

test('Settings switch is off for Light and on for Dark, without redundant help icons', async () => {
  const s = await setup('screens/SettingsScreen.js');
  assert.equal(find(s.render(), 'Switch').props.value, false);
  assert.equal(find(s.render(), 'ScreenHeader').props.subtitle, undefined);
  assert.equal(find(s.render(), 'FieldLabel', p => Boolean(p.help) && p.label !== 'Data Management'), undefined);
  s.setDark(true); assert.equal(find(s.render(), 'Switch').props.value, true);
});

test('file picker fills the material draft, saves the permanent URI and cleans up only unsaved copies', async () => {
  const s = await setup('components/MaterialSheet.js');
  const props = { userId: 'owner', subjectId: 7, onClose() {}, onSaved: s.onSaved };
  assert.equal(find(s.render(props), 'Input', p => p.label.includes('URL')), undefined);
  const browse = find(s.render(props), 'Button', p => p.label === 'Browse File Manager').props.onPress;
  browse(); browse(); await s.flush();
  assert.equal(s.actions.filter(action => action[0] === 'pick').length, 1);
  assert.equal(find(s.render(props), 'Input', p => p.label === 'Title').props.value, 'Notes.pdf');
  find(s.render(props), 'Button', p => p.label === 'Save Material').props.onPress(); await s.flush();
  const input = s.actions.find(action => action[0] === 'createMaterial')[3];
  assert.equal(input.local_file_path, 'file:///documents/materials/user-owner/notes.pdf');
  s.unmount(); assert.equal(s.actions.some(action => action[0] === 'discard'), false);
  const cancelled = await setup('components/MaterialSheet.js');
  find(cancelled.render(props), 'Button', p => p.label === 'Browse File Manager').props.onPress(); await cancelled.flush();
  cancelled.unmount(); await cancelled.flush();
  assert.equal(cancelled.actions.at(-1)[0], 'discard');
});

test('manual journal draft validates, survives failure and saves through the workspace once', async () => {
  const s = await setup('components/JournalEntrySheet.js'); let success = false, calls = 0;
  const props = { busy: false, onClose() {}, onSave: async () => { calls++; return success; } };
  const render = () => s.render(props);
  find(render(), 'Button').props.onPress(); await s.flush(); assert.equal(calls, 0);
  find(render(), 'Input', p => p.label === 'Title').props.onChangeText('Study Plan');
  find(render(), 'Input', p => p.label === 'Content').props.onChangeText('Practise diagrams.');
  const save = find(render(), 'Button').props.onPress; save(); save(); await s.flush();
  assert.equal(calls, 1); assert.equal(find(render(), 'Input', p => p.label === 'Content').props.value, 'Practise diagrams.');
  success = true; find(render(), 'Button').props.onPress(); await s.flush(); assert.equal(calls, 2);
  const workspace = await setup('components/StudyWorkspace.js');
  const state = () => workspace.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  state().openJournalEntry(); assert.equal(state().journalEntryOpen, true);
  await state().saveJournalEntry({ title: 'Study Plan', content: 'Practise diagrams.' });
  assert.equal(state().journalEntryOpen, false); assert.equal(state().notice, 'Journal entry saved.');
  assert.equal(workspace.refreshes(), 1);
});

test('post-session reflection keeps the note on failure, saves once and supports skipping', async () => {
  const s = await setup('components/CompletionReflectionSheet.js'); let saved = false, closed = 0, calls = 0;
  const props = { block: { subject_name: 'Biology', task_title: 'Read cells' }, busy: false, onClose: () => { closed++; }, onAdd: async () => { calls++; return saved; } };
  const render = () => s.render(props);
  find(render(), 'Button', p => p.label === 'Save Reflection').props.onPress(); await s.flush();
  assert.equal(calls, 0, 'blank notes do not submit');
  find(render(), 'Input').props.onChangeText('I can explain the stages now.');
  const save = find(render(), 'Button', p => p.label === 'Save Reflection').props.onPress;
  save(); save(); await s.flush();
  assert.equal(calls, 1); assert.equal(find(render(), 'Input').props.value, 'I can explain the stages now.');
  assert.match(find(render(), 'Message').props.text, /still here/);
  saved = true; find(render(), 'Button', p => p.label === 'Save Reflection').props.onPress(); await s.flush();
  assert.equal(calls, 2);
  find(render(), 'Button', p => p.label === 'Skip').props.onPress(); assert.equal(closed, 1);
});

test('Settings exposes JSON help without a disconnected clock-format switch', async () => {
  const real = await setup('screens/SettingsScreen.js');
  assert.equal(find(real.render(), 'Button', p => p.label === 'Load Demo Data'), undefined);
  const help = find(real.render(), 'FieldLabel', p => p.label === 'Data Management').props.help;
  assert.match(help, /only supported way to back up/);
  assert.equal(find(real.render(), 'Switch', p => p.accessibilityLabel === '24-Hour Time'), undefined);
  find(real.render(), 'Button', p => p.label === 'Edit Display Name').props.onPress();
  const profile = find(real.render(), 'DisplayNameSheet');
  await profile.props.onSave('New Name'); profile.props.onClose();
  assert.ok(find(real.render(), 'Text', p => p.children === 'New Name'));
  const workspace = await setup('components/StudyWorkspace.js');
  await workspace.render({ children: 'screen' }, 'StudyWorkspace').props.value.loadDemoData();
  assert.equal(workspace.actions.some(action => action[0] === 'seed'), false, 'real-mode demo mutation is guarded too');
});

test('new subject codes start empty and editing retains the saved code', async () => {
  const s = await setup('components/EntrySheet.js');
  const props = { kind: 'subject', userId: 'owner', subjects: s.data.subjects, onSaved: s.onSaved, onClose() {}, onDeleted() {} };
  const input = find(s.render(props), 'Input', p => p.label === 'Subject Code');
  assert.equal(input.props.value, ''); assert.equal(input.props.placeholder, 'e.g. GEN-101');
  const edit = await setup('components/EntrySheet.js');
  assert.equal(find(edit.render({ ...props, editingSubject: subject }), 'Input', p => p.label === 'Subject Code').props.value, subject.subject_code);
});

test('duration replacement is anchored to Start even across rapid edits and final save', async () => {
  const s = await setup('components/ScheduleSheet.js');
  const props = { userId: 'owner', task, onClose() {}, onSaved: s.onSaved };
  const render = () => s.render(props);
  const change = find(render(), 'Input', p => p.label === 'Duration (Optional)').props.onChangeText;
  const start = find(render(), 'DateTimeField', p => p.label === 'Start').props.value;
  change('1h'); change('2h'); change('45m');
  assert.equal(find(render(), 'DateTimeField', p => p.label === 'End').props.value.getTime() - start.getTime(), 45 * 60000);
  find(render(), 'Button', p => p.label === 'Save Session').props.onPress(); await s.flush();
  assert.equal(Date.parse(s.schedules[0][1].end_time) - Date.parse(s.schedules[0][1].start_time), 45 * 60000);
});

test('native time fields follow the saved format in their labels and Android/iOS controls', async () => {
  for (const platform of ['android', 'ios']) {
    const s = await setup('components/DateTimeField.js', { platform }); s.time.is24Hour = false;
    const props = { label: 'Start', help: 'Choose Start', value: new Date('2026-10-20T17:30:00'), minimumDate: new Date('2026-10-20T00:00:00'), onChange() {} };
    const time = find(s.render(props), 'Pressable', p => p.accessibilityLabel?.startsWith('Start time:'));
    assert.match(time.props.accessibilityLabel, /05:30 PM/); time.props.onPress();
    if (platform === 'android') assert.equal(s.actions.at(-1)[1].is24Hour, false);
    else assert.equal(find(s.render(props), 'NativePicker', p => p.mode === 'time').props.locale, 'en-US');
    s.time.is24Hour = true;
    assert.match(find(s.render(props), 'Pressable', p => p.accessibilityLabel?.startsWith('Start time:')).props.accessibilityLabel, /17:30/);
  }
});

test('display-name sheet keeps a failed draft, blocks duplicate saves and closes after success', async () => {
  const s = await setup('components/DisplayNameSheet.js'); let calls = 0, closed = 0, fail = true;
  const props = { name: 'Alex', onClose: () => { closed++; }, onSave: async () => { calls++; if (fail) throw new Error('Network unavailable'); } };
  find(s.render(props), 'Input').props.onChangeText('Alex Tan');
  const save = find(s.render(props), 'Button').props.onPress; save(); save(); await s.flush();
  assert.equal(calls, 1); assert.equal(closed, 0); assert.equal(find(s.render(props), 'Input').props.value, 'Alex Tan');
  fail = false; find(s.render(props), 'Button').props.onPress(); await s.flush(); assert.equal(closed, 1);
});

test('scheduled block actions mark done once and require confirmation before deleting only a block', async () => {
  const card = await setup('components/StudyCards.js');
  const block = { id: 12, status: 'scheduled', subject_name: 'Biology', subject_color: '#123ABC', start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' };
  const pressed = [];
  const props = { block, today: '2026-10-20', readyToStart: false, canStart: true, disabled: false, working: false,
    onMarkDone: id => pressed.push(['done', id]), onDelete: value => pressed.push(['delete', value.id]), onStart() {}, onReschedule() {} };
  const cardTree = card.render(props, 'FocusCard');
  assert.equal(find(cardTree, 'Button', p => p.label === 'Mark as Done' || p.label === 'Delete Block'), undefined);
  const menu = find(cardTree, 'ItemActionsMenu');
  assert.deepEqual(Array.from(menu.props.actions, action => action.label), ['Mark as Done', 'Delete Block']);
  menu.props.actions[0].onPress(); menu.props.actions[1].onPress();
  assert.deepEqual(pressed, [['done', 12], ['delete', 12]]);
  const start = find(cardTree, 'Button', p => p.label === 'Start Session');
  assert.equal(start.props.tone, 'primary'); assert.equal(start.props.disabled, true, 'future sessions cannot start early');
  assert.equal(find(card.render({ ...props, readyToStart: true }, 'FocusCard'), 'Button', p => p.label === 'Start Session').props.disabled, false);
  assert.equal(find(card.render({ ...props, readyToStart: true, canStart: false }, 'FocusCard'), 'Button', p => p.label === 'Start Session').props.disabled, false, 'an active-session conflict is explained on tap');
  const s = await setup('components/StudyWorkspace.js', { hold: true });
  s.data.blocks = [block];
  const state = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  state().confirmDeleteBlock(block); state().confirmDeleteBlock(block);
  assert.equal(s.alerts.length, 0); assert.equal(s.actions.length, 0);
  assert.equal(state().blockDeletion.id, 12); assert.equal(state().blocked, true);
  const modal = find(s.render({ children: 'screen' }, 'StudyWorkspace'), 'BlockDeletionModal');
  assert.ok(modal); modal.props.onCancel(); assert.equal(state().blockDeletion, null);
  state().confirmDeleteBlock(block);
  const remove = state().deleteConfirmedBlock; remove(); remove(); await s.flush();
  state().cancelBlockDeletion(); assert.ok(state().blockDeletion, 'in-flight deletion cannot be dismissed');
  assert.deepEqual(s.actions, [['deleteBlock', 'owner', 12]]);
  s.release(); await s.flush(); assert.equal(s.refreshes(), 1); assert.equal(state().blockDeletion, null);
  const mark = await setup('components/StudyWorkspace.js', { hold: true });
  const value = () => mark.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  const first = value().markDone(12); await value().markDone(12);
  assert.equal(mark.actions.length, 1); mark.release(); await first;
  assert.equal(value().reflectionPrompt.actual_study_seconds, 1800);
});

test('themed block deletion retains errors for retry and rejects unowned/resolved prompts', async () => {
  const s = await setup('components/StudyWorkspace.js', { failure: true });
  const block = { id: 12, status: 'scheduled', task_title: 'Cells' };
  s.data.blocks = [block];
  const state = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  state().confirmDeleteBlock({ ...block, id: 99 }); assert.equal(state().blockDeletion, null);
  state().confirmDeleteBlock(block); await state().deleteConfirmedBlock();
  assert.equal(state().blockDeletion.id, 12); assert.match(state().blockDeleteError, /Could not delete/);
  assert.equal(state().deletingBlock, false); assert.equal(state().blocked, true);
  s.fail(false); await state().deleteConfirmedBlock();
  assert.equal(state().blockDeletion, null); assert.equal(state().notice, 'Block deleted.'); assert.equal(s.refreshes(), 1);
  s.data.blocks = [{ ...block, status: 'done' }];
  state().confirmDeleteBlock(block); assert.equal(state().blockDeletion, null);
  assert.equal(s.alerts.length, 0);
});

test('both journal entry kinds open full text, retain failed edit drafts and require deletion confirmation', async () => {
  for (const kind of ['entry', 'reflection']) {
    const s = await setup('components/JournalEntryContent.js', { failure: true });
    const item = { id: `${kind}-1`, source_id: 1, kind, title: 'Study Notes', content: 'Full note\nSecond paragraph', created_at: '2026-10-20T10:00:00Z', subject_name: 'Biology' };
    let removed = 0;
    const props = { userId: 'owner', item, onClose() {}, onSaved: s.onSaved, onDeleted: () => { removed++; } };
    const render = () => s.render(props);
    assert.ok(find(render(), 'Text', p => p.children === item.content));
    find(render(), 'Button', p => p.label === 'Edit').props.onPress();
    assert.equal(Boolean(find(render(), 'Input', p => p.label === 'Title')), kind === 'entry');
    find(render(), 'Input', p => p.label !== 'Title').props.onChangeText('Revised draft');
    const save = find(render(), 'Button', p => p.label === 'Save Changes').props.onPress;
    save(); save(); await s.flush();
    assert.equal(s.actions.filter(action => action[0] === 'editJournal').length, 1);
    assert.equal(find(render(), 'Input', p => p.label !== 'Title').props.value, 'Revised draft');
    s.fail(false); find(render(), 'Button', p => p.label === 'Save Changes').props.onPress(); await s.flush(); assert.equal(s.saved(), 1);
    find(render(), 'Button', p => p.label === 'Delete').props.onPress(); s.alerts[0][2][0].onPress();
    assert.equal(removed, 0);
    find(render(), 'Button', p => p.label === 'Delete').props.onPress();
    const remove = s.alerts[1][2][1].onPress; remove(); remove(); await s.flush();
    assert.equal(removed, 1); assert.equal(s.actions.filter(action => action[0] === 'deleteJournal').length, 1);
    assert.equal(s.actions.at(-1).at(-1), kind);
  }
});

test('session name updates replace the local profile immediately without changing ID and exclude sign-out races', async () => {
  const s = await setup('auth/SessionContext.js', { hold: true });
  const state = () => s.render({ children: 'screen' }, 'SessionProvider').props.value;
  state(); await s.flush(); assert.equal(state().user.id, 'owner');
  const saving = state().updateName('Alex Tan');
  await assert.rejects(state().updateName('Duplicate'), /Wait/);
  await state().signOut(); assert.equal(s.actions.some(action => action[0] === 'signOut'), false);
  assert.equal(state().updatingName, true); s.release(); await saving;
  assert.equal(state().user.name, 'Alex Tan'); assert.equal(state().user.id, 'owner');
  const failed = await setup('auth/SessionContext.js', { failure: true });
  const value = () => failed.render({ children: 'screen' }, 'SessionProvider').props.value;
  value(); await failed.flush();
  await assert.rejects(value().updateName('New Name'), /unavailable/);
  assert.equal(value().user.name, 'Alex'); assert.equal(value().updatingName, false);
});

test('completion sheet shows saved start lateness after the live timer has finished', async () => {
  const s = await setup('components/CompletionReflectionSheet.js');
  const props = { block: { subject_name: 'Biology', task_title: 'Cells', status: 'done', start_time: '2026-10-20T09:00:00Z', actual_start_time: '2026-10-20T09:13:00Z' }, busy: false, onClose() {}, onAdd: async () => true };
  assert.ok(find(s.render(props), 'Text', p => p.children === 'Session complete! You started 13 minutes late.'));
  props.block.actual_start_time = props.block.start_time;
  assert.ok(find(s.render(props), 'Text', p => p.children === 'You started exactly on time!'));
  props.block.actual_start_time = null;
  assert.ok(find(s.render(props), 'Text', p => p.children === 'Session complete!'));
});

test('Coach card renders only one note, handles overdue/streak data and formats best-hour suggestions', async () => {
  const s = await setup('components/CoachCard.js');
  const props = { tasks: [{ ...task, postpone_count: 2 }], scheduledMinutes: 300,
    history: { completedToday: true, completedYesterday: true, bestHour: 17 }, now: Date.parse('2026-10-20T12:00:00Z') };
  assert.ok(find(s.render(props), 'Text', p => p.children.includes?.("I noticed you've been postponing Read cells")));
  props.tasks = [{ ...task, deadline: '2026-10-19', postpone_count: 2 }];
  assert.ok(find(s.render(props), 'Text', p => p.children.includes?.('overdue task in Biology')));
  props.tasks = [];
  assert.ok(find(s.render(props), 'Text', p => p.children === 'Heavy day ahead! Remember to take breaks.'));
  props.scheduledMinutes = 240;
  assert.ok(find(s.render(props), 'Text', p => p.children.includes?.("You're on a 2-day streak")));
  props.history = { ...props.history, completedYesterday: false };
  assert.ok(find(s.render(props), 'Text', p => p.children.includes?.('17:00')));
  s.time.is24Hour = false; props.now++;
  assert.ok(find(s.render(props), 'Text', p => p.children.includes?.('05:00 PM')));
  props.history = { ...props.history, bestHour: null };
  assert.equal(s.render(props), null);
});

test('large-screen lists retain bounded virtualization and stable callbacks; static Home rows receive narrow props', async () => {
  for (const file of ['screens/JournalScreen.js', 'screens/LibraryScreen.js', 'screens/HomeScreen.js']) {
    const s = await setup(file);
    s.study.controlTimer = async (...args) => s.actions.push(['timer', ...args]);
    s.study.openReschedule = block => s.actions.push(['reschedule', block]);
    s.data.blocks = [{ id: 42, status: 'scheduled', start_time: '2026-10-20T12:00:00Z', end_time: '2026-10-20T12:30:00Z' }];
    s.data.journal = [{ id: 'entry-1', kind: 'entry', title: 'Plan', content: 'Next Steps', created_at: '2026-10-20T10:00:00Z' }];
    let list = find(s.render(), 'FlatList');
    assert.equal(list.props.initialNumToRender, 10); assert.equal(list.props.maxToRenderPerBatch, 10);
    assert.equal(list.props.windowSize, 5); assert.equal(list.props.removeClippedSubviews, !file.includes('Library'));
    const renderItem = list.props.renderItem;
    const row = renderItem({ item: list.props.data[0] });
    if (!file.includes('Home')) assert.ok(s.memoized.has(row.type));
    else {
      const coach = find(list.props.ListHeaderComponent, 'CoachCard');
      assert.equal(coach.props.tasks, s.data.tasks); assert.equal(coach.props.scheduledMinutes, s.data.minutes);
      assert.equal(find(list.props.ListHeaderComponent, 'CoachingCard'), undefined, 'Home does not stack older coaching cards');
      assert.equal(row.props.readyToStart, false);
      row.props.onStart(42); await s.flush(); assert.deepEqual(s.actions.at(-1), ['timer', 42, 'start']);
    }
    s.study.clock += 30000;
    list = find(s.render(), 'FlatList');
    if (!file.includes('Home')) assert.equal(list.props.renderItem, renderItem, 'unrelated clock ticks preserve callback identity');
    else {
      const next = list.props.renderItem({ item: list.props.data[0] });
      assert.deepEqual(next.props, row.props, 'unchanged readiness does not invalidate memoized focus cards');
      s.study.clock = Date.parse(s.data.blocks[0].start_time);
      list = find(s.render(), 'FlatList');
      assert.equal(list.props.renderItem({ item: list.props.data[0] }).props.readyToStart, true, 'readiness still changes at scheduled start');
    }
  }
});

test('descriptions prefill, edit and appear only on notebook task cards', async () => {
  const s = await setup('components/EntrySheet.js');
  const editing = { ...task, description: 'Read chapter 4\nDraw the stages' };
  const props = { kind: 'task', userId: 'owner', subjects: s.data.subjects, editingTask: editing, onSaved: s.onSaved, onClose() {} };
  const description = find(s.render(props), 'Input', p => p.label === 'Task Description');
  assert.equal(description.props.value, editing.description); assert.equal(description.props.multiline, true);
  description.props.onChangeText('New detailed instructions');
  find(s.render(props), 'Button', p => p.label === 'Save Changes').props.onPress(); await s.flush();
  assert.equal(s.updates[0][2].description, 'New detailed instructions');
  const card = await setup('components/StudyCards.js');
  assert.ok(find(card.render({ task: editing, notebook: true }, 'TaskCard'), 'Text', p => p.children === editing.description));
  assert.equal(find(card.render({ task: editing }, 'TaskCard'), 'Text', p => p.children === editing.description), undefined);
});

test('Mock Settings includes demo loading and materials require confirmation before deletion', async () => {
  const settings = await setup('screens/SettingsScreen.js', { realAuth: false }); let loaded = 0;
  settings.study.loadDemoData = () => { loaded++; };
  find(settings.render(), 'Button', p => p.label === 'Load Demo Data').props.onPress();
  assert.equal(loaded, 1);
  const s = await setup('components/StudyWorkspace.js');
  const material = { id: 6, subject_id: 7, title: 'Notes' }; s.data.materials = [material];
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  render().confirmDeleteMaterial(material); assert.equal(s.alerts[0][0], 'Delete Material');
  s.alerts[0][2][0].onPress(); assert.equal(s.actions.length, 0);
  render().confirmDeleteMaterial(material); const confirm = s.alerts[1][2][1].onPress;
  confirm(); confirm(); await s.flush();
  assert.deepEqual(s.actions, [['deleteMaterial', 'owner', 6]]); assert.equal(s.refreshes(), 1);
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
  assert.deepEqual(s.updates.map(args => JSON.parse(JSON.stringify(args))), [['owner', 9, { title: 'New title', description: '', subject_id: 8 }], ['owner', 9, { title: 'New title', description: '', subject_id: 8 }]]);
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
    const element = list.props.renderItem({ item: row });
    return find(s.render(element.props, element.type), 'TaskCard').props;
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
  find(render(false), 'ItemActionsMenu').props.onEdit();
  find(render(false), 'ItemActionsMenu').props.onDelete();
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
    const scroll = find(shelf, 'FlatList');
    return scroll.props.renderItem({ item: scroll.props.data[0] });
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
  const list = find(tree, 'FlatList');
  assert.ok(list); assert.equal(find(tree, 'TaskCard'), undefined);
  assert.equal(find(tree, 'Button', p => p.label.includes('New Task')), undefined);
  const row = list.props.renderItem({ item: list.props.data[0] });
  find(s.render(row.props, row.type), 'Bookshelf').props.onOpen(subject);
  assert.equal(s.actions[0][0], 'push');
  assert.equal(s.actions[0][1].pathname, '/library/[subjectId]');
  assert.equal(s.actions[0][1].params.subjectId, '7');
  find(find(list.props.ListHeaderComponent, 'ScreenHeader').props.action, 'Button', p => p.label === 'Add Subject').props.onPress();
  assert.deepEqual(s.actions.at(-1), ['entry', 'subject']);
});

test('Opened Book scopes tasks, prefills New Task, supports book actions and redirects stale/unowned IDs', async () => {
  const s = await setup('screens/OpenedBookScreen.js');
  s.data.tasks = [task, { ...task, id: 10, subject_id: 8 }];
  const renderList = () => find(s.render(), 'FlatList');
  let list = renderList();
  assert.deepEqual(list.props.data, [task]);
  const row = list.props.renderItem({ item: task });
  assert.equal(find(s.render(row.props, row.type), 'TaskCard').props.notebook, true);
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
      const list = find(s.render(props), 'FlatList');
      const element = list.props.renderItem({ item: list.props.data[0] });
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

test('books retain identical vibrant gradients across themes and shelf add uses its field', async () => {
  const s = await setup('components/SubjectBookshelf.js');
  const fields = [];
  const props = { subjects: [subject], taskCounts: new Map(), onOpen() {}, onEdit() {}, onAddField: field => fields.push(field) };
  const shelf = () => s.render(props);
  const renderBook = () => { const list = find(shelf(), 'FlatList'); const element = list.props.renderItem({ item: list.props.data[0] }); return s.render(element.props, element.type); };
  const stored = subject.field_colors;
  const light = find(renderBook(), 'Gradient').props.colors;
  s.setDark(true);
  const dark = find(renderBook(), 'Gradient').props.colors;
  assert.deepEqual(dark, light);
  assert.equal(subject.field_colors, stored);
  s.setDark(false); assert.deepEqual(find(renderBook(), 'Gradient').props.colors, light);
  find(shelf(), 'Pressable', p => p.accessibilityLabel === 'Add Subject to Sciences').props.onPress();
  assert.deepEqual(fields, ['Sciences']);
  props.disabled = true;
  assert.equal(find(shelf(), 'Pressable', p => p.accessibilityLabel === 'Add Subject to Sciences').props.disabled, true);
});

test('shelf add routes a field-prefilled draft through the shared workspace and resets it for other forms', async () => {
  const library = await setup('screens/LibraryScreen.js');
  const list = find(library.render(), 'FlatList');
  const row = list.props.renderItem({ item: list.props.data[0] });
  find(library.render(row.props, row.type), 'Bookshelf').props.onAddField('Computer Science');
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
  find(render(), 'Input', p => p.label === 'Subject Code').props.onChangeText('GEN-101');
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


test('list subscriptions ignore toast changes and the workspace no longer publishes a ticking clock', async () => {
  const s = await setup('components/StudyWorkspace.js');
  const render = () => s.render({ children: 'screen' }, 'StudyWorkspace');
  const before = render();
  const lists = find(before, 'Provider', p => p.value !== before.props.value);
  assert.ok(lists);
  before.props.value.setNotice('Saved.');
  const after = render();
  assert.notEqual(before.props.value.notice, after.props.value.notice);
  assert.equal(find(after, 'Provider', p => p.value !== after.props.value).props.value, lists.props.value);
  assert.equal('clock' in after.props.value, false);
});

test('Journal routes both entry kinds into dedicated screens and rejects unknown sources', async () => {
  const s = await setup('components/StudyWorkspace.js');
  s.data.journal = [{ id: 'entry-1' }, { id: 'reflection-2' }];
  const state = () => s.render({ children: 'screen' }, 'StudyWorkspace').props.value;
  for (const item of s.data.journal) {
    state().openJournalDetail(item);
    assert.equal(s.actions.at(-1)[1].pathname, '/journal/[entryId]');
    assert.equal(s.actions.at(-1)[1].params.entryId, item.id);
    assert.equal(state().blocked, false);
  }
  const count = s.actions.length;
  state().openJournalDetail({ id: 'entry-unknown' });
  assert.equal(s.actions.length, count);
  const page = await setup('screens/JournalEntryScreen.js');
  page.data.journal = [{ id: 'entry-1', kind: 'entry', title: 'Notes', content: 'Full text' }];
  page.route('entry-1');
  assert.ok(find(page.render(), 'JournalEntryContent'));
  assert.equal(find(page.render(), 'Modal'), undefined);
  assert.ok(find(page.render(), 'KeyboardAvoidingView'));
  page.route('entry-999'); assert.equal(page.render().type, 'Redirect');
});

test('scheduler switches clock format in place without changing the selected instants', async () => {
  const s = await setup('components/ScheduleSheet.js');
  const props = { userId: 'owner', task, onClose() {}, onSaved() {} };
  const before = find(s.render(props), 'DateTimeField', p => p.label === 'Start').props.value;
  find(s.render(props), 'Pressable', p => p.accessibilityLabel === 'Switch to 12h').props.onPress();
  assert.equal(s.time.is24Hour, false);
  assert.ok(find(s.render(props), 'Pressable', p => p.accessibilityLabel === 'Switch to 24h'));
  assert.equal(find(s.render(props), 'DateTimeField', p => p.label === 'Start').props.value, before);
});

test('Library header exposes Add Subject and a count while animated shelves remain unclipped on iOS', async () => {
  const s = await setup('screens/LibraryScreen.js');
  const list = find(s.render(), 'FlatList');
  const header = find(list.props.ListHeaderComponent, 'ScreenHeader');
  assert.equal(header.props.badge, String(s.data.subjects.length));
  assert.ok(find(header.props.action, 'Button', p => p.label === 'Add Subject'));
  assert.equal(list.props.ListFooterComponent, undefined);
  assert.equal(list.props.removeClippedSubviews, false);
  const android = await setup('screens/LibraryScreen.js', { platform: 'android' });
  assert.equal(find(android.render(), 'FlatList').props.removeClippedSubviews, true);
});

test('saved journal text remains readable without a refresh and cancelling the next edit preserves it', async () => {
  const s = await setup('components/JournalEntryContent.js');
  const item = { id: 'entry-1', source_id: 1, kind: 'entry', title: 'Plan', content: 'Original note', created_at: '2026-10-29T12:00:00Z' };
  const props = { item, userId: 'owner', onSaved: s.onSaved, onDeleted() {} };
  const render = () => s.render(props);
  find(render(), 'Button', p => p.label === 'Edit').props.onPress();
  find(render(), 'Input', p => p.label === 'Content').props.onChangeText('  Saved note  ');
  find(render(), 'Button', p => p.label === 'Save Changes').props.onPress(); await s.flush();
  assert.ok(find(render(), 'Text', p => p.children === 'Saved note'));
  find(render(), 'Button', p => p.label === 'Edit').props.onPress();
  assert.equal(find(render(), 'Input', p => p.label === 'Content').props.value, 'Saved note');
  find(render(), 'Input', p => p.label === 'Content').props.onChangeText('Discarded draft');
  find(render(), 'Button', p => p.label === 'Cancel Editing').props.onPress();
  assert.ok(find(render(), 'Text', p => p.children === 'Saved note'));
});


test('picked content references bypass manual limits, save as references and are never cleaned as app-owned copies', async () => {
  const uri = `content://com.android.providers.downloads.documents/document/${'part%2F'.repeat(700)}42`;
  const pickedFile = { uri, name: 'External Notes.pdf', copied: false };
  const props = { userId: 'owner', subjectId: 7, onClose() {}, onSaved() {} };
  const s = await setup('components/MaterialSheet.js', { pickedFile });
  find(s.render(props), 'Button', p => p.label === 'Browse File Manager').props.onPress(); await s.flush();
  assert.ok(find(s.render(props), 'Text', p => p.children === 'File Reference Selected'));
  assert.equal(find(s.render(props), 'Text', p => p.children === 'File Saved to App Storage'), undefined);
  find(s.render(props), 'Button', p => p.label === 'Use URL / File Path').props.onPress();
  assert.equal(find(s.render(props), 'Input', p => p.label.includes('URL')).props.value, uri);
  find(s.render(props), 'Button', p => p.label === 'Save Material').props.onPress(); await s.flush();
  const input = s.actions.find(action => action[0] === 'createMaterial')[3];
  assert.equal(input.location, uri); assert.equal(input.local_file_path, null);
  assert.equal(find(s.render(props), 'Message').props.text, '');
  s.unmount(); await s.flush(); assert.equal(s.actions.some(action => action[0] === 'discard'), false);
  const cancelled = await setup('components/MaterialSheet.js', { pickedFile });
  find(cancelled.render(props), 'Button', p => p.label === 'Browse File Manager').props.onPress(); await cancelled.flush();
  cancelled.unmount(); await cancelled.flush(); assert.equal(cancelled.actions.some(action => action[0] === 'discard'), false);
});

test('manually replacing a picked reference restores input validation and keeps invalid drafts', async () => {
  const s = await setup('components/MaterialSheet.js', { pickedFile: { uri: 'content://provider/document/42', name: 'Notes.pdf', copied: false } });
  const props = { userId: 'owner', subjectId: 7, onClose() {}, onSaved() {} };
  find(s.render(props), 'Button', p => p.label === 'Browse File Manager').props.onPress(); await s.flush();
  find(s.render(props), 'Button', p => p.label === 'Use URL / File Path').props.onPress();
  const change = value => find(s.render(props), 'Input', p => p.label.includes('URL')).props.onChangeText(value);
  const save = async () => { find(s.render(props), 'Button', p => p.label === 'Save Material').props.onPress(); await s.flush(); };
  change('relative-notes.pdf'); await save();
  assert.match(find(s.render(props), 'Message').props.text, /absolute file path/);
  assert.equal(s.actions.some(action => action[0] === 'createMaterial'), false);
  change('x'.repeat(4097)); await save();
  assert.match(find(s.render(props), 'Message').props.text, /4,096/);
  change('https://example.com/notes'); await save();
  assert.equal(s.actions.find(action => action[0] === 'createMaterial')[3].location, 'https://example.com/notes');
});
