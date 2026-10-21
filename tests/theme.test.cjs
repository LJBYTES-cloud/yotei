const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual provider with an isolated hook host and native/storage bridges.
// JSX is compiled by the project's TypeScript dependency; no device is required.
async function setup({ saved = null, readError = false, writeError = false, holdRead = false, holdWrite = false } = {}) {
  let slots = [], cursor = 0, effects = [], cleanups = [];
  const warnings = [], writes = [], appearance = [];
  let releaseRead, releaseWrite;
  const readGate = holdRead ? new Promise(resolve => { releaseRead = resolve; }) : Promise.resolve();
  const writeGate = holdWrite ? new Promise(resolve => { releaseWrite = resolve; }) : Promise.resolve();
  const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
  const dependenciesEqual = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => { throw new Error('Not used by provider'); },
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
        assert.equal(key, 'yotei.theme');
        await readGate;
        if (readError) throw new Error('Read unavailable');
        return saved;
      },
      setItem: async (key, value) => {
        assert.equal(key, 'yotei.theme');
        writes.push(value);
        await writeGate;
        if (writeError) { writeError = false; throw new Error('Write unavailable'); }
        saved = value;
      },
    } },
  };
  const source = ts.transpileModule(fs.readFileSync('ThemeContext.js', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: 'ThemeContext.jsx',
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(name => new vm.SyntheticModule(Object.keys(modules[name]), function () {
    for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
  }, { context }));
  await module.evaluate();
  function render() {
    cursor = 0; effects = [];
    const output = module.namespace.ThemeProvider({ children: 'screens' });
    for (const effect of effects) effect();
    return output;
  }
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return {
    render, flush, writes, warnings, appearance,
    releaseRead: () => releaseRead?.(), releaseWrite: () => releaseWrite?.(),
    remount: () => { for (const cleanup of cleanups) cleanup?.(); slots = []; cleanups = []; },
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
  assert.equal(value.subjectColor('#2DD4BF'), '#000000');
  assert.deepEqual(s.appearance, ['light']);
  assert.deepEqual(s.writes, []);
});

test('missing, invalid, or unavailable preferences safely use dark mode', async () => {
  for (const options of [{}, { saved: 'invalid' }, { readError: true }]) {
    const s = await setup(options);
    s.render(); await s.flush();
    assert.equal(s.render().props.value.isDark, true);
    assert.equal(s.warnings.length, options.readError ? 1 : 0);
  }
});

test('rapid toggles serialize writes and the final preference survives provider remount', async () => {
  const s = await setup({ holdWrite: true });
  s.render(); await s.flush();
  const value = s.render().props.value;
  value.toggleTheme(); value.toggleTheme(); value.toggleTheme();
  assert.equal(s.render().props.value.isDark, false);
  await s.flush();
  assert.deepEqual(s.writes, ['light'], 'second write waits for the first');
  s.releaseWrite(); await s.flush();
  assert.deepEqual(s.writes, ['light', 'dark', 'light']);
  s.remount(); assert.equal(s.render(), null); await s.flush();
  assert.equal(s.render().props.value.isDark, false);
});

test('a failed write keeps the current UI usable and does not block the next save', async () => {
  const s = await setup({ writeError: true });
  s.render(); await s.flush();
  s.render().props.value.toggleTheme(); await s.flush();
  assert.equal(s.render().props.value.isDark, false);
  assert.equal(s.warnings.length, 1);
  s.render().props.value.toggleTheme(); await s.flush();
  assert.deepEqual(s.writes, ['light', 'dark']);
  s.remount(); s.render(); await s.flush();
  assert.equal(s.render().props.value.isDark, true);
});
