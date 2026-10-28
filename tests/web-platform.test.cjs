const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

test('web database has no native or WASM imports and rejects unsupported storage', async () => {
  const module = new vm.SourceTextModule(fs.readFileSync('db/database.web.js', 'utf8'));
  await module.link(name => { throw new Error(`Unexpected web database dependency: ${name}`); });
  await module.evaluate();
  await assert.rejects(module.namespace.getDatabase(), /Android and iOS app/);
  assert.doesNotThrow(() => module.namespace.requireUserId('student'));
  assert.throws(() => module.namespace.requireUserId(' '), /Sign in/);
});

async function renderApplication(platform, { fontsLoaded = true, fontError = null, inspect = false } = {}) {
  const context = vm.createContext({});
  let cursor = 0, themeReads = 0;
  const slots = [];
  const theme = { colors: { background: '#F8F6F2' }, isDark: false };
  const session = { user: { id: 'owner' }, restoring: false, restoreError: '' };
  const modules = {
    react: { useMemo: (factory, deps) => {
      const i = cursor++;
      if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i].deps[index]))) slots[i] = { value: factory(), deps };
      return slots[i].value;
    } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { Stack: { Screen: 'StackScreen', Protected: 'Protected' }, DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, ThemeProvider: 'NavigationThemeProvider' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: styles => styles }, Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: null },
    './auth/SessionContext': { SessionProvider: 'SessionProvider', useSession: () => { if (platform === 'web') throw new Error('Web must not restore a session'); return session; } },
    './ThemeContext': { ThemeProvider: 'ThemeProvider', lightPalette: { background: '#F8F6F2' }, useTheme: () => { themeReads++; return theme; } },
    './TimeFormatContext': { TimeFormatProvider: 'TimeFormatProvider' },
    'expo-font': { useFonts: faces => { assert.equal(Object.keys(faces).length, 6); return [fontsLoaded, fontError]; } },
  };
  for (const face of ['Merriweather_400Regular', 'Merriweather_700Bold', 'Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold']) {
    const [family, weight] = face.split('_');
    modules[`@expo-google-fonts/${family.toLowerCase()}/${weight}`] = { [face]: 1 };
  }
  const source = ts.transpileModule(fs.readFileSync('App.js', 'utf8'), {
    fileName: 'App.jsx',
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async name => {
    if (name === './components/typography') {
      const typography = new vm.SourceTextModule(fs.readFileSync('components/typography.js', 'utf8'), { context });
      await typography.link(() => { throw new Error('Unexpected typography dependency'); }); return typography;
    }
    assert.ok(modules[name], `Unexpected application dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
      for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const root = module.namespace.default();
  if (!root) return root;
  if (root.type.name === 'StartupScreen') return root.type();
  let application = root.props.children;
  while (typeof application.type === 'string') application = application.props.children;
  let output = application.type(application.props);
  if (output.type.name === 'WebNotice') output = output.type(output.props);
  if (inspect) return { output, themeReads: () => themeReads, theme, session, renderRoutes: () => { cursor = 0; return output.props.children.type(); } };
  return output;
}

test('web root shows the mobile notice before mounting authentication or study routes', async () => {
  const output = await renderApplication('web');
  assert.equal(output.type, 'View');
  const card = output.props.children[1];
  assert.equal(card.props.children[0].props.children, 'Open Yotei on Mobile');
  assert.match(card.props.children[1].props.children, /native SQLite/);
});

test('root waits for its six bundled font faces and can recover with system fallback after a font error', async () => {
  const startup = await renderApplication('web', { fontsLoaded: false });
  assert.equal(startup.props.style.backgroundColor, '#F8F6F2');
  assert.equal(startup.props.children.props.style, 'dark');
  assert.equal((await renderApplication('web', { fontsLoaded: false, fontError: new Error('Font unavailable') })).type, 'View');
});

test('Android and iOS roots still mount the session and protected routes', async () => {
  for (const platform of ['android', 'ios']) {
    const output = await renderApplication(platform);
    assert.equal(output.type, 'SessionProvider');
    assert.equal(output.props.children.type.name, 'Routes');
  }
});

test('native session boundary ignores theme updates and navigation values stay stable across auth-only renders', async () => {
  const s = await renderApplication('android', { inspect: true });
  assert.equal(s.themeReads(), 0, 'Application must not subscribe SessionProvider to theme changes');
  const light = s.renderRoutes();
  s.session.restoring = true;
  const restoring = s.renderRoutes();
  assert.equal(restoring.props.value, light.props.value);
  assert.equal(restoring.props.children[1].props.screenOptions, light.props.children[1].props.screenOptions);
  s.theme.isDark = true; s.theme.colors = { background: '#121412' };
  const dark = s.renderRoutes();
  assert.notEqual(dark.props.value, light.props.value);
  assert.equal(dark.props.value.colors.background, '#121412');
});
