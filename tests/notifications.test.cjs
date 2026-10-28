const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function find(node, type, predicate = () => true) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type && predicate(node.props)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, type, predicate); if (match) return match; }
}

// Execute the actual UI with controlled hooks, native components and clock.
async function setup(file) {
  const slots = [], timers = new Map(), listeners = new Map(), animations = [], alerts = [];
  let cursor = 0, now = 0, nextTimer = 0, effects = [], dark = false, dismissals = 0;
  const colors = () => ({ surface: dark ? '#1C201D' : '#FFFFFF', background: dark ? '#121412' : '#F8F6F2',
    text: dark ? '#F0F0F0' : '#1F1F1F', accent: dark ? '#7CB58F' : '#2D5A41', muted: '#777777', line: '#E0DCD3', onAccent: '#FFFFFF', overlay: '#00000080' });
  const study = { notice: 'Reflection saved.', noticeId: 1, blocked: false, dismissNotice: () => { dismissals++; study.notice = ''; } };
  const hooks = {
    createContext: () => ({}), useContext: () => null,
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback: callback => callback,
    useEffect(callback, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, index) => !Object.is(dep, previous.deps[index]))) {
        slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = callback(); });
      }
    },
  };
  const modules = {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name])),
      StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } }, Platform: { OS: 'ios' },
      Alert: { alert: (...args) => alerts.push(args) },
      Keyboard: { addListener: (event, callback) => { listeners.set(event, callback); return { remove: () => listeners.delete(event) }; } },
      Animated: { View: 'AnimatedView', Value: class { setValue() {} interpolate(config) { return config; } },
        timing: (_value, config) => { const animation = { ...config, stopped: false }; return { start: () => animations.push(animation), stop: () => { animation.stopped = true; } }; } },
    },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    'expo-router/js-tabs': { BottomTabBar: 'BottomTabBar' },
    '../ThemeContext': { useTheme: () => ({ colors: colors(), isDark: dark }), useThemedStyles: factory => factory(colors()) },
    './StudyWorkspace': { useStudy: () => study }, './Toast': { default: 'Toast' }, './InfoModal': { default: 'InfoModal' },
    './ui': { Button: 'Button', Message: 'Message' },
  };
  const context = vm.createContext({ setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; }, clearTimeout: id => timers.delete(id) });
  const module = new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: 'component.jsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText, { context });
  await module.link(async name => {
    if (name === './typography') {
      const typography = new vm.SourceTextModule(fs.readFileSync('components/typography.js', 'utf8'), { context });
      await typography.link(() => { throw new Error('Unexpected typography import'); }); return typography;
    }
    assert.ok(modules[name], `Unexpected dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(modules[name]), function () { for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return {
    study, animations, alerts, timers, listeners, dismissals: () => dismissals, setDark: value => { dark = value; },
    render(props, exported = 'default') { cursor = 0; effects = []; const node = module.namespace[exported](props); for (const effect of effects) effect(); return node; },
    advance(milliseconds) { now += milliseconds; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('toast slides up, expires after three seconds, resets identical notices and cleans up on unmount', async () => {
  const s = await setup('components/Toast.js');
  let dismissed = 0;
  const props = { message: 'Reflection saved.', noticeId: 1, onDismiss: () => { dismissed++; } };
  assert.ok(find(s.render(props), 'Text', p => p.children === props.message));
  assert.equal(s.animations[0].useNativeDriver, true);
  s.advance(2999); assert.equal(dismissed, 0);
  s.render({ ...props, noticeId: 2 });
  assert.equal(s.animations[0].stopped, true);
  s.advance(1); assert.equal(dismissed, 0, 'the previous timeout must not dismiss the new occurrence');
  s.advance(2999); assert.equal(dismissed, 1);
  s.render({ ...props, noticeId: 3 }); s.unmount(); s.advance(3000);
  assert.equal(dismissed, 1); assert.equal(s.timers.size, 0);
});

test('hidden toast renders nothing but still expires on time instead of resurfacing stale messages', async () => {
  const s = await setup('components/Toast.js'); let dismissed = 0;
  const props = { message: 'Task created.', noticeId: 1, onDismiss: () => { dismissed++; } };
  s.render(props); assert.equal(s.render({ ...props, hidden: true }), null);
  s.advance(3000); assert.equal(dismissed, 1);
  s.render(props); s.advance(3000); assert.equal(dismissed, 1, 'showing the same occurrence must not restart its timeout');
  assert.equal(s.render({ ...props, message: '' }), null);
});

test('one tab-bar host suppresses/discards Settings messages and hides during keyboard or sheets', async () => {
  const s = await setup('components/ToastTabBar.js');
  const props = index => ({ state: { index, routes: [{ name: 'reflections' }, { name: 'settings' }, { name: 'library' }] } });
  let tree = s.render(props(0));
  assert.equal(find(tree, 'Toast').props.hidden, false);
  assert.equal(find(tree, 'BottomTabBar').props.state.index, 0);
  tree = s.render(props(1)); assert.equal(find(tree, 'Toast').props.hidden, true);
  assert.equal(s.study.notice, ''); assert.equal(s.dismissals(), 1);
  s.study.notice = 'Backup prepared.'; s.study.noticeId++;
  s.render(props(1)); assert.equal(s.study.notice, ''); assert.equal(s.dismissals(), 2);
  assert.equal(find(s.render(props(2)), 'Toast').props.message, '', 'Settings must not leak a queued message back to another tab');
  s.listeners.get('keyboardDidShow')(); assert.equal(find(s.render(props(2)), 'Toast').props.hidden, true);
  s.listeners.get('keyboardDidHide')(); s.study.blocked = true;
  assert.equal(find(s.render(props(2)), 'Toast').props.hidden, true);
  s.study.blocked = false; assert.equal(find(s.render(props(2)), 'Toast').props.hidden, false);
  s.unmount(); assert.equal(s.listeners.size, 0);
});

test('info button opens a local themed modal and closes without a native alert', async () => {
  const s = await setup('components/ui.js');
  const props = { title: 'Daily Study Time', message: 'Planned minutes count toward the daily threshold.' };
  const render = () => s.render(props, 'InfoButton');
  assert.equal(find(render(), 'InfoModal'), undefined);
  find(render(), 'Pressable').props.onPress();
  assert.equal(find(render(), 'InfoModal').props.title, props.title);
  assert.equal(find(render(), 'InfoModal').props.message, props.message);
  find(render(), 'InfoModal').props.onClose();
  assert.equal(find(render(), 'InfoModal'), undefined); assert.equal(s.alerts.length, 0);
});

test('information dialog uses theme/fonts, scrolls and supports backdrop, close, OK and native back', async () => {
  const s = await setup('components/InfoModal.js'); let closed = 0;
  const props = { title: 'Field Colors', message: 'Choose one or two colors.', onClose: () => { closed++; } };
  let tree = s.render(props);
  assert.equal(find(tree, 'Text', p => p.children === props.title).props.style.fontFamily, 'Merriweather_700Bold');
  assert.equal(find(tree, 'Text', p => p.children === props.message).props.style.fontFamily, 'Inter_400Regular');
  assert.ok(find(tree, 'ScrollView'));
  assert.equal(find(tree, 'View', p => p.accessibilityViewIsModal).props.style.backgroundColor, '#FFFFFF');
  find(tree, 'Modal').props.onRequestClose();
  find(tree, 'Pressable', p => Boolean(p.style?.position)).props.onPress();
  find(tree, 'Pressable', p => p.accessibilityLabel === 'Close Information' && !p.style?.position).props.onPress();
  find(tree, 'Pressable', p => typeof p.style === 'function').props.onPress();
  assert.equal(closed, 4);
  s.setDark(true); tree = s.render(props);
  assert.equal(find(tree, 'View', p => p.accessibilityViewIsModal).props.style.backgroundColor, '#1C201D');
  assert.equal(find(tree, 'Text', p => p.children === props.title).props.style.color, '#F0F0F0');
});

test('block confirmation follows both themes/fonts and guards cancel/confirm while deleting', async () => {
  const s = await setup('components/BlockDeletionModal.js'); let canceled = 0, confirmed = 0;
  const props = { taskTitle: 'Read Chapter 4', busy: false, error: 'Could not delete this block. Try again.', onCancel: () => { canceled++; }, onConfirm: () => { confirmed++; } };
  let tree = s.render(props);
  assert.equal(find(tree, 'Text', p => p.children === 'Delete Block?').props.style.fontFamily, 'Merriweather_700Bold');
  assert.equal(find(tree, 'Text', p => typeof p.children === 'string' && p.children.startsWith('Delete this scheduled')).props.style.fontFamily, 'Inter_400Regular');
  assert.equal(find(tree, 'View', p => p.accessibilityViewIsModal).props.style.backgroundColor, '#FFFFFF');
  assert.equal(find(tree, 'Message').props.text, props.error);
  find(tree, 'Modal').props.onRequestClose();
  find(tree, 'Pressable', p => p.accessibilityLabel === 'Cancel Block Deletion').props.onPress();
  find(tree, 'Button', p => p.label === 'Cancel').props.onPress();
  find(tree, 'Button', p => p.label === 'Delete Block').props.onPress();
  assert.equal(canceled, 3); assert.equal(confirmed, 1);
  props.busy = true; tree = s.render(props);
  find(tree, 'Modal').props.onRequestClose();
  find(tree, 'Button', p => p.label === 'Delete Block').props.onPress();
  assert.equal(find(tree, 'Button', p => p.label === 'Cancel').props.disabled, true);
  assert.equal(find(tree, 'Button', p => p.label === 'Delete Block').props.busy, true);
  assert.equal(canceled, 3); assert.equal(confirmed, 1);
  s.setDark(true); tree = s.render(props);
  assert.equal(find(tree, 'View', p => p.accessibilityViewIsModal).props.style.backgroundColor, '#1C201D');
  assert.equal(find(tree, 'Text', p => p.children === 'Delete Block?').props.style.color, '#F0F0F0');
  assert.equal(s.alerts.length, 0);
});
