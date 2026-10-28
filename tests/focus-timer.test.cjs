const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

async function setup() {
  let now = Date.parse('2026-10-20T09:25:34Z'), cursor = 0, nextInterval = 0;
  const slots = [], intervals = new Map(), listeners = new Set(), focus = new Map(), calls = [];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, setInterval: callback => { const id = ++nextInterval; intervals.set(id, callback); return id; }, clearInterval: id => intervals.delete(id) });
  const study = { disabled: false, workingBlock: null, workingTimerAction: null,
    controlTimer: async (id, action) => calls.push([id, action]), complete: async id => calls.push([id, 'finish']) };
  const appState = { currentState: 'active', addEventListener: (_event, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } };
  const palette = { text: '#000000', muted: '#000000', accent: '#000000', warm: '#000000' };
  const modules = {
    react: {
      memo: component => component,
      useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = value; }]; },
      useCallback(callback) { const index = cursor++; if (!slots[index]) slots[index] = callback; return slots[index]; },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { AppState: appState, StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    'expo-router': { useFocusEffect: callback => { if (!focus.has(callback)) focus.set(callback, callback()); } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    '../ThemeContext': { useTheme: () => ({ colors: palette, subjectColor: () => '#000000' }), useThemedStyles: factory => factory(palette) },
    './StudyWorkspace': { useStudy: () => study }, './studyStyles': { createStudyStyles: () => ({}) }, './ui': { Button: 'Button' },
  };
  const helpers = new vm.SourceTextModule(fs.readFileSync('utils/focusTimer.js', 'utf8'), { context });
  await helpers.link(() => { throw new Error('Unexpected import'); }); await helpers.evaluate();
  const source = ts.transpileModule(fs.readFileSync('components/FocusTimer.js', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: 'FocusTimer.jsx',
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  const typography = new vm.SourceTextModule(fs.readFileSync('components/typography.js', 'utf8'), { context });
  await typography.link(() => { throw new Error('Unexpected typography import'); });
  await module.link(name => name === './typography' ? typography : name === '../utils/focusTimer' ? helpers : new vm.SyntheticModule(Object.keys(modules[name]), function () {
    for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
  }, { context })); await module.evaluate();
  const block = { id: 7, task_title: 'Cell cycle', subject_name: 'Biology', subject_color: '#123ABC', start_time: '2026-10-20T09:00:00Z',
    status: 'active', actual_start_time: '2026-10-20T09:13:00Z', actual_end_time: null, break_started_at: null, break_time_ms: 0, actual_study_seconds: 0 };
  function render() { cursor = 0; return module.namespace.default({ block }); }
  function nodes(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  const text = () => nodes(render()).filter(node => node.type === 'Text').map(node => [node.props.children].flat().join('')).join('\n');
  const button = label => nodes(render()).find(node => node.type === 'Button' && node.props.label === label).props;
  return { render, text, button, block, study, calls, intervals,
    advance: ms => { now += ms; for (const tick of intervals.values()) tick(); },
    appState: state => { appState.currentState = state; for (const listener of listeners) listener(state); },
    dispose: () => { for (const cleanup of focus.values()) cleanup?.(); },
  };
}

test('live focus view counts work without lateness feedback, freezes on break and wires resume/finish', async () => {
  const s = await setup();
  assert.match(s.text(), /12:34/); assert.doesNotMatch(s.text(), /late|on time/i);
  s.button('Take Break').onPress(); assert.deepEqual(s.calls, [[7, 'break']]);
  s.block.break_started_at = '2026-10-20T09:25:34Z'; s.advance(60000);
  assert.match(s.text(), /12:34 studied · work paused/); assert.match(s.text(), /1:00/);
  s.button('Resume Work').onPress(); assert.deepEqual(s.calls.at(-1), [7, 'resume']);
  s.block.break_started_at = null; s.block.break_time_ms = 60000; s.advance(60000);
  assert.match(s.text(), /13:34/);
  s.button('Finish Session').onPress(); assert.deepEqual(s.calls.at(-1), [7, 'finish']);
  s.block.actual_start_time = '2026-10-20T09:00:30Z';
  assert.doesNotMatch(s.text(), /late|on time/i);
  s.block.actual_start_time = s.block.start_time;
  assert.doesNotMatch(s.text(), /Started .* late/);
  s.dispose(); assert.equal(s.intervals.size, 0);
});

test('foreground display catches up from persisted instants and clears its background interval', async () => {
  const s = await setup(); s.render();
  s.appState('background'); assert.equal(s.intervals.size, 0);
  s.advance(5 * 60000); s.appState('active');
  assert.match(s.text(), /17:34/); assert.equal(s.intervals.size, 1);
  s.study.disabled = true; s.study.workingBlock = 7; s.study.workingTimerAction = 'finish';
  assert.equal(s.button('Finish Session').disabled, true); assert.equal(s.button('Finish Session').busy, true);
  assert.equal(s.button('Take Break').busy, false);
  s.dispose();
});
