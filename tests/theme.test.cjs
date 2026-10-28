const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual provider with an isolated hook host and native/storage bridges.
// JSX is compiled by the project's TypeScript dependency; no device is required.
async function setup({ saved = null, readError = false, writeError = false, holdRead = false, holdWrite = false,
  filename = 'ThemeContext.js', storageKey = 'yotei.theme', provider = 'ThemeProvider' } = {}) {
  let slots = [], cursor = 0, effects = [], cleanups = [];
  const warnings = [], writes = [], appearance = [];
  const styleInstances = new Map();
  let activeTheme;
  let releaseRead, releaseWrite;
  const readGate = holdRead ? new Promise(resolve => { releaseRead = resolve; }) : Promise.resolve();
  const writeGate = holdWrite ? new Promise(resolve => { releaseWrite = resolve; }) : Promise.resolve();
  const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
  const dependenciesEqual = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => activeTheme,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !dependenciesEqual(slots[index].deps, deps)) slots[index] = { value: callback(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !dependenciesEqual(slots[index].deps, deps)) {
        slots[index] = { deps };
        effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); });
      }
    },
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Appearance: { setColorScheme: value => appearance.push(value) }, Platform: { OS: 'ios' } },
    'expo-system-ui': { setBackgroundColorAsync: async () => {} },
    '@react-native-async-storage/async-storage': { default: {
      getItem: async key => {
        assert.equal(key, storageKey);
        await readGate;
        if (readError) throw new Error('Read unavailable');
        return saved;
      },
      setItem: async (key, value) => {
        assert.equal(key, storageKey);
        writes.push(value);
        await writeGate;
        if (writeError) { writeError = false; throw new Error('Write unavailable'); }
        saved = value;
      },
    } },
  };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: 'ThemeContext.jsx',
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async name => {
    if (name === './utils/timeFormat') {
      const helpers = new vm.SourceTextModule(fs.readFileSync('utils/timeFormat.js', 'utf8'), { context });
      await helpers.link(() => { throw new Error('Unexpected time import'); }); return helpers;
    }
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
    for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  function render() {
    cursor = 0; effects = [];
    const output = module.namespace[provider]({ children: 'screens' });
    for (const effect of effects) effect();
    return output;
  }
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return {
    render, flush, writes, warnings, appearance,
    releaseRead: () => releaseRead?.(), releaseWrite: () => releaseWrite?.(),
    remount: () => { for (const cleanup of cleanups) cleanup?.(); slots = []; cleanups = []; },
    palettes: { light: module.namespace.lightPalette, dark: module.namespace.darkPalette },
    renderStyles: (factory, colors, instance = 'row') => {
      const providerSlots = slots;
      slots = styleInstances.get(instance) ?? []; styleInstances.set(instance, slots);
      cursor = 0; activeTheme = { colors };
      const styles = module.namespace.useThemedStyles(factory);
      slots = providerSlots;
      return styles;
    },
  };
}

test('restores light before mounting screens, without writing the default theme', async () => {
  const s = await setup({ saved: 'light', holdRead: true });
  assert.equal(s.render(), null);
  assert.deepEqual(s.appearance, []);
  s.releaseRead(); await s.flush();
  const { value, children } = s.render().props;
  assert.equal(children, 'screens');
  assert.equal(value.isDark, false);
  assert.equal(value.subjectColor('#2DD4BF'), '#1F1F1F');
  assert.deepEqual(s.appearance, ['light']);
  assert.deepEqual(s.writes, []);
});

test('missing, invalid, or unavailable preferences safely use light mode without overwriting storage', async () => {
  for (const options of [{}, { saved: 'dark' }, { saved: 'light' }, { saved: 'invalid' }, { saved: '{"version":1,"mode":"dark"}' }, { readError: true }]) {
    const s = await setup(options);
    s.render(); await s.flush();
    assert.equal(s.render().props.value.isDark, false);
    assert.deepEqual(s.writes, []);
    assert.equal(s.warnings.length, options.readError ? 1 : 0);
  }
});

test('rapid toggles serialize writes and the final preference survives provider remount', async () => {
  const s = await setup({ holdWrite: true });
  s.render(); await s.flush();
  const value = s.render().props.value;
  value.toggleTheme(); value.toggleTheme(); value.toggleTheme();
  assert.equal(s.render().props.value.isDark, true);
  await s.flush();
  assert.deepEqual(s.writes.map(value => JSON.parse(value).mode), ['dark'], 'second write waits for the first');
  s.releaseWrite(); await s.flush();
  assert.deepEqual(s.writes.map(value => JSON.parse(value).mode), ['dark', 'light', 'dark']);
  s.remount(); assert.equal(s.render(), null); await s.flush();
  assert.equal(s.render().props.value.isDark, true);
});

test('a failed write keeps the current UI usable and does not block the next save', async () => {
  const s = await setup({ writeError: true });
  s.render(); await s.flush();
  s.render().props.value.toggleTheme(); await s.flush();
  assert.equal(s.render().props.value.isDark, true);
  assert.equal(s.warnings.length, 1);
  s.render().props.value.toggleTheme(); await s.flush();
  assert.deepEqual(s.writes.map(value => JSON.parse(value).mode), ['dark', 'light']);
  s.remount(); s.render(); await s.flush();
  assert.equal(s.render().props.value.isDark, false);
});

test('an explicitly saved dark preference still restores before screens mount', async () => {
  const s = await setup({ saved: JSON.stringify({version: 2, mode: 'dark'}), holdRead: true });
  assert.equal(s.render(), null);
  s.releaseRead(); await s.flush();
  assert.equal(s.render().props.value.isDark, true);
  assert.deepEqual(s.appearance, ['dark']); assert.deepEqual(s.writes, []);
});

test('provider identity stays stable on unrelated renders and the UI toggles before storage finishes', async () => {
  const s = await setup({ holdWrite: true }); s.render(); await s.flush();
  const light = s.render().props.value;
  assert.equal(s.render().props.value, light);
  light.toggleTheme();
  const dark = s.render().props.value;
  assert.notEqual(dark, light); assert.equal(dark.isDark, true);
  assert.equal(dark.toggleTheme, light.toggleTheme);
  assert.equal(s.render().props.value, dark);
  s.releaseWrite(); await s.flush();
});

test('themed styles build once per factory/palette across rows and reuse earlier styles when toggling back', async () => {
  const s = await setup(); let builds = 0;
  const factory = colors => { builds++; return { label: { color: colors.text } }; };
  const light = s.renderStyles(factory, s.palettes.light, 'row-1');
  assert.equal(s.renderStyles(factory, s.palettes.light, 'row-2'), light);
  assert.equal(builds, 1);
  const dark = s.renderStyles(factory, s.palettes.dark, 'row-1');
  assert.notEqual(dark, light); assert.equal(dark.label.color, '#F0F0F0');
  assert.equal(s.renderStyles(factory, s.palettes.dark, 'row-2'), dark);
  assert.equal(s.renderStyles(factory, s.palettes.light, 'row-1'), light);
  assert.equal(builds, 2);
  assert.notEqual(s.renderStyles(colors => ({ color: colors.text }), s.palettes.light), light);
});

test('time preference hydrates before screens, defaults to 24 hours and preserves saved 12-hour choice', async () => {
  for (const saved of [null, 'invalid', '24', '12']) {
    const s = await setup({ saved, filename: 'TimeFormatContext.js', storageKey: 'yotei.time-format.v1', provider: 'TimeFormatProvider', holdRead: true });
    assert.equal(s.render(), null); assert.deepEqual(s.writes, []);
    s.releaseRead(); await s.flush();
    const pref = s.render().props.value, midnight = new Date('2026-10-20T00:00:00');
    assert.equal(pref.is24Hour, saved !== '12');
    assert.equal(pref.formatTime(midnight).includes('00:00'), saved !== '12');
    assert.deepEqual(s.writes, [], 'hydration does not overwrite a preference');
  }
});

test('rapid time toggles save in order, survive remount and recover from storage failures', async () => {
  const options = { filename: 'TimeFormatContext.js', storageKey: 'yotei.time-format.v1', provider: 'TimeFormatProvider' };
  const s = await setup({ ...options, holdWrite: true });
  s.render(); await s.flush(); const pref = s.render().props.value;
  pref.set24Hour(false); pref.set24Hour(true); pref.set24Hour(false); await s.flush();
  assert.deepEqual(s.writes, ['12']); s.releaseWrite(); await s.flush();
  assert.deepEqual(s.writes, ['12', '24', '12']);
  s.remount(); s.render(); await s.flush(); assert.equal(s.render().props.value.is24Hour, false);
  const failed = await setup({ ...options, readError: true, writeError: true });
  failed.render(); await failed.flush(); assert.equal(failed.render().props.value.is24Hour, true);
  failed.render().props.value.set24Hour(false); await failed.flush();
  failed.render().props.value.set24Hour(true); await failed.flush();
  assert.deepEqual(failed.writes, ['12', '24']);
});

test('time formatter handles noon, midnight, date-time labels and invalid input independently of elapsed durations', async () => {
  const module = new vm.SourceTextModule(fs.readFileSync('utils/timeFormat.js', 'utf8'));
  await module.link(() => { throw new Error('Unexpected import'); }); await module.evaluate();
  const { formatTime, formatDateTime } = module.namespace;
  assert.equal(formatTime(new Date('2026-10-20T00:00:00'), true, 'en-US'), '00:00');
  assert.equal(formatTime('2026-10-20T12:00:00', false, 'en-US'), '12:00 PM');
  assert.equal(formatTime('2026-10-20T17:30:00', false, 'en-US'), '05:30 PM');
  assert.equal(formatTime('2026-10-20T17:30:00', true, 'en-US'), '17:30');
  assert.match(formatDateTime('2026-10-20T17:30:00', false, 'en-US'), /05:30 PM/);
  assert.match(formatDateTime('2026-10-20T17:30:00', true, 'en-US'), /17:30/);
  assert.equal(formatTime('bad'), 'Unavailable');
});
