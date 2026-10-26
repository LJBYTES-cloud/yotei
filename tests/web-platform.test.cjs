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

async function renderApplication(platform) {
  const context = vm.createContext({});
  const modules = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { Stack: 'Stack', DarkTheme: {}, DefaultTheme: {}, ThemeProvider: 'NavigationThemeProvider' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: styles => styles }, Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: null },
    './auth/SessionContext': { SessionProvider: 'SessionProvider', useSession: () => { throw new Error('Web must not restore a session'); } },
    './ThemeContext': { ThemeProvider: 'ThemeProvider', useTheme: () => ({ colors: {}, isDark: true }) },
  };
  const source = ts.transpileModule(fs.readFileSync('App.js', 'utf8'), {
    fileName: 'App.jsx',
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(name => {
    assert.ok(modules[name], `Unexpected application dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
      for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const root = module.namespace.default();
  const application = root.props.children.props.children;
  return application.type(application.props);
}

test('web root shows the mobile notice before mounting authentication or study routes', async () => {
  const output = await renderApplication('web');
  assert.equal(output.type, 'View');
  const card = output.props.children[1];
  assert.equal(card.props.children[0].props.children, 'Open Yotei on mobile');
  assert.match(card.props.children[1].props.children, /native SQLite/);
});

test('Android and iOS roots still mount the session and protected routes', async () => {
  for (const platform of ['android', 'ios']) {
    const output = await renderApplication(platform);
    assert.equal(output.type, 'SessionProvider');
    assert.equal(output.props.children.type.name, 'Routes');
  }
});
