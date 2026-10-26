const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise EntrySheet's actual confirmation callbacks with native UI bridges
// substituted; database cascades are covered separately against production SQL.
async function setup({ fail = false, pending = false, editing = true } = {}) {
  const slots = [], alerts = [], deletions = [];
  let cursor = 0, saved = 0, deleted = 0, release;
  const gate = pending ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const context = vm.createContext({});
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
      },
      useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
      useMemo(callback) { return callback(); },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-native': { ActivityIndicator: 'Spinner', Alert: { alert: (...args) => alerts.push(args) }, Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    '../db/SubjectService': {
      createSubject: async () => { saved++; }, updateSubject: async () => { saved++; },
      deleteSubject: async (userId, id) => { deletions.push({ userId, id }); await gate; if (fail) throw new Error('Storage failed'); },
    },
    '../db/TaskService': { createTask: async () => { saved++; }, updateTask: async () => { saved++; } },
    './ui': Object.fromEntries(['Button', 'FieldLabel', 'Input', 'Message', 'Pill', 'Sheet'].map(name => [name, name])),
    '../ThemeContext': { useTheme: () => ({ colors: { text: '#000000', line: '#E0E0E0' }, isDark: false }), useThemedStyles: () => ({}) },
  };
  const fields = new vm.SourceTextModule(fs.readFileSync('utils/subjectFields.js', 'utf8'), { context });
  await fields.link(() => { throw new Error('Unexpected import'); }); await fields.evaluate();
  const source = ts.transpileModule(fs.readFileSync('components/EntrySheet.js', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: 'EntrySheet.jsx',
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  const typography = new vm.SourceTextModule(fs.readFileSync('components/typography.js', 'utf8'), { context });
  await typography.link(() => { throw new Error('Unexpected typography import'); });
  await module.link(name => name === './typography' ? typography : name === '../utils/subjectFields' ? fields : new vm.SyntheticModule(Object.keys(modules[name]), function () {
    for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value);
  }, { context }));
  await module.evaluate();
  const subject = { id: 7, user_id: 'owner', name: 'Biology', field_of_study: 'Sciences', field_colors: '#123ABC,#DEF456' };
  function render() {
    cursor = 0;
    return module.namespace.default({ kind: 'subject', userId: 'owner', subjects: [subject], editingSubject: editing ? subject : null,
      onSaved: () => { saved++; }, onDeleted: () => { deleted++; }, onClose: () => {} });
  }
  function find(node, type, predicate = () => true) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type && predicate(node.props)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type, predicate); if (found) return found; }
  }
  const deleteButton = () => find(render(), 'Pressable', props => props.accessibilityLabel === 'Delete Subject');
  return { render, find, deleteButton, alerts, deletions, get saved() { return saved; }, get deleted() { return deleted; },
    release: () => release?.(), flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('Delete Subject only appears in edit mode; Cancel never calls the delete service', async () => {
  const creation = await setup({ editing: false });
  assert.equal(creation.deleteButton(), undefined);
  const s = await setup();
  s.deleteButton().props.onPress();
  assert.equal(s.alerts.length, 1);
  const [, message, buttons] = s.alerts[0];
  assert.equal(message, 'Are you sure you want to delete this subject? All associated tasks and reviews will also be permanently deleted.');
  assert.equal(buttons[0].text, 'Cancel'); assert.equal(buttons[1].text, 'Delete'); assert.equal(buttons[1].style, 'destructive');
  assert.equal(s.deleteButton().props.disabled, true);
  buttons[0].onPress(); await s.flush();
  assert.equal(s.deletions.length, 0); assert.equal(s.saved, 0); assert.equal(s.deleted, 0);
  assert.equal(s.deleteButton().props.disabled, false);
});

test('confirmation deletes the original subject once, prevents overlapping saves, and reports success', async () => {
  const s = await setup({ pending: true });
  s.deleteButton().props.onPress();
  s.deleteButton().props.onPress();
  assert.equal(s.alerts.length, 1);
  const confirm = s.alerts[0][2][1].onPress;
  confirm(); confirm();
  s.alerts[0][3].onDismiss();
  s.find(s.render(), 'Button', props => props.label === 'Save Changes').props.onPress();
  assert.deepEqual(s.deletions, [{ userId: 'owner', id: 7 }]);
  assert.equal(s.saved, 0); assert.equal(s.deleted, 0);
  assert.equal(s.deleteButton().props.disabled, true);
  s.release(); await s.flush();
  assert.equal(s.deleted, 1);
});

test('deletion failure keeps the edit sheet and draft available for retry; dismissing confirmation does not delete', async () => {
  const s = await setup({ fail: true });
  s.deleteButton().props.onPress(); s.alerts[0][2][1].onPress(); await s.flush();
  assert.equal(s.deleted, 0);
  assert.match(s.find(s.render(), 'Message').props.text, /Could not delete/);
  assert.equal(s.find(s.render(), 'Input', props => props.label === 'Subject Name').props.value, 'Biology');
  assert.equal(s.deleteButton().props.disabled, false);
  s.deleteButton().props.onPress(); s.alerts[1][3].onDismiss(); await s.flush();
  assert.equal(s.deletions.length, 1);
  assert.equal(s.deleteButton().props.disabled, false);
});
