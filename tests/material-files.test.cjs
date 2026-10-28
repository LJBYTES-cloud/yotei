const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

async function setup({ holdDirectory = false } = {}) {
  const files = new Map([['file:///cache/picked.pdf', 'original document']]), calls = [], warnings = [];
  let releaseDirectory;
  const directoryGate = holdDirectory ? new Promise(resolve => { releaseDirectory = resolve; }) : Promise.resolve();
  const created = new Set();
  const device = { canceled: false, failCopy: false, failDirectory: false, sourceUri: 'file:///cache/picked.pdf' };
  const join = parts => parts.map(part => typeof part === 'string' ? part : part.uri).reduce((uri, part) => uri ? `${uri.replace(/\/$/, '')}/${part}` : part, '');
  class Directory {
    constructor(...parts) { this.uri = new URL(join(parts)).href; }
    async create(options) {
      calls.push(['create', this.uri, options]);
      if (device.failDirectory) throw new Error('Storage unavailable');
      await directoryGate; created.add(this.uri.replace(/\/$/, ''));
    }
  }
  class File {
    constructor(...parts) {
      this.uri = new URL(join(parts)).href;
      if (this.uri.startsWith('content://')) throw new Error('File cannot parse this provider URI');
    }
    get exists() { return files.has(this.uri); }
    async copy() { throw new Error('Use the provider-compatible copyAsync implementation'); }
    async delete() { calls.push(['delete', this.uri]); files.delete(this.uri); }
  }
  const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
  const module = new vm.SourceTextModule(fs.readFileSync('utils/materialFiles.js', 'utf8'), { context });
  const mocks = {
    'expo-file-system': { Directory, File, Paths: { document: new Directory('file:///documents'), cache: new Directory('file:///cache') },
      copyAsync: async () => { throw new Error('SDK 57 root copyAsync is a deprecated throwing stub'); } },
    'expo-file-system/legacy': { copyAsync: async ({ from, to }) => {
      calls.push(['copy', from, to]);
      assert.ok(created.has(to.slice(0, to.lastIndexOf('/'))), 'destination directory must finish creating before copy');
      assert.equal(files.has(from), true);
      files.set(to, files.get(from));
      if (device.failCopy) throw new Error('Storage full');
    } },
    'expo-document-picker': { getDocumentAsync: async options => {
      calls.push(['pick', options]);
      return device.canceled ? { canceled: true, assets: null } : { canceled: false, assets: [{ uri: device.sourceUri, name: '../Week 1.pdf' }] };
    } },
  };
  await module.link(name => new vm.SyntheticModule(Object.keys(mocks[name]), function () { for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value); }, { context }));
  await module.evaluate();
  return { ...module.namespace, files, calls, device, warnings, releaseDirectory: () => releaseDirectory?.(), flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('picked documents copy into permanent, account-scoped storage and survive clearing picker cache', async () => {
  const s = await setup();
  const picked = await s.pickMaterialFile('owner');
  assert.match(picked.uri, /^file:\/\/\/documents\/materials\/user-owner\//);
  assert.equal(s.files.get(picked.uri), 'original document');
  assert.equal(picked.copied, true);
  assert.equal(s.calls[0][1].copyToCacheDirectory, true);
  assert.equal(s.calls[0][1].multiple, false);
  s.files.delete('file:///cache/picked.pdf');
  assert.equal(s.files.get(picked.uri), 'original document');
});

test('picker cancellation changes no files; copy failure retains the original reference and removes only the partial app copy', async () => {
  const s = await setup(); s.device.canceled = true;
  assert.equal(await s.pickMaterialFile('owner'), null);
  assert.equal(s.calls.some(call => call[0] === 'copy'), false);
  s.device.canceled = false; s.device.failCopy = true;
  const selected = await s.pickMaterialFile('owner');
  assert.equal(selected.uri, 'file:///cache/picked.pdf'); assert.equal(selected.copied, false);
  assert.equal(s.warnings.length, 1); assert.match(s.warnings[0][0], /original file reference/);
  assert.deepEqual([...s.files.keys()], ['file:///cache/picked.pdf']);
});

test('unsaved cleanup cannot delete a provider document or another account file', async () => {
  const s = await setup();
  const first = await s.pickMaterialFile('owner'), other = await s.pickMaterialFile('other');
  await s.discardMaterialFile('owner', 'file:///cache/picked.pdf');
  await s.discardMaterialFile('owner', other.uri);
  assert.equal(s.files.has('file:///cache/picked.pdf'), true); assert.equal(s.files.has(other.uri), true);
  await s.discardMaterialFile('owner', first.uri); assert.equal(s.files.has(first.uri), false);
  const unusual = await s.pickMaterialFile('..'); assert.match(unusual.uri, /\/materials\/user-\.\.\//);
});

test('Android content providers copy without constructing a File from the source URI', async () => {
  const s = await setup();
  s.device.sourceUri = 'content://com.android.providers.downloads.documents/document/42';
  s.files.set(s.device.sourceUri, 'provider document');
  const picked = await s.pickMaterialFile('owner');
  assert.equal(s.files.get(picked.uri), 'provider document');
  assert.equal(s.calls.find(call => call[0] === 'copy')[1], s.device.sourceUri);
  await s.discardMaterialFile('owner', picked.uri);
  assert.equal(s.files.has(picked.uri), false);
  assert.equal(s.files.has(s.device.sourceUri), true);
});

test('failed content copies return the original provider URI, log the reason and remove only the partial destination', async () => {
  const s = await setup();
  s.device.sourceUri = 'content://com.android.externalstorage.documents/document/primary%3Anotes.pdf';
  s.files.set(s.device.sourceUri, 'original provider document'); s.device.failCopy = true;
  const selected = await s.pickMaterialFile('owner');
  assert.equal(selected.uri, s.device.sourceUri); assert.equal(selected.copied, false);
  assert.match(s.warnings[0][1].message, /Storage full/);
  await s.discardMaterialFile('owner', selected.uri);
  assert.equal(s.files.get(s.device.sourceUri), 'original provider document');
  assert.equal([...s.files.keys()].some(uri => uri.startsWith('file:///documents/')), false);
});

test('unavailable private directories also fall back to the selected reference without claiming a saved copy', async () => {
  const s = await setup(); s.device.failDirectory = true;
  const selected = await s.pickMaterialFile('owner');
  assert.equal(selected.uri, s.device.sourceUri); assert.equal(selected.copied, false);
  assert.equal(s.calls.some(call => call[0] === 'copy'), false);
  assert.equal(s.warnings.length, 1);
});

test('private document copies wait for directory creation and keep the cache-copy picker option', async () => {
  const s = await setup({ holdDirectory: true });
  const pending = s.pickMaterialFile('owner'); await s.flush();
  assert.equal(s.calls[0][1].copyToCacheDirectory, true);
  assert.equal(s.calls.some(call => call[0] === 'copy'), false);
  s.releaseDirectory(); const picked = await pending;
  assert.equal(picked.copied, true); assert.match(picked.uri, /^file:\/\/\/documents\/materials\/user-owner\//);
});

test('sharing keeps private files intact and stages provider URIs as local cache files for Android Sharing', async () => {
  const s = await setup();
  const localUri = 'file:///documents/materials/user-owner/notes.pdf';
  assert.equal(await s.getShareableMaterialUri('owner', localUri), localUri);
  assert.equal(s.calls.length, 0, 'existing private copies require no extra copy');
  const provider = 'content://com.android.providers.downloads.documents/document/42';
  s.files.set(provider, 'provider bytes');
  const staged = await s.getShareableMaterialUri('owner', provider, 'Class Notes.pdf');
  assert.match(staged, /^file:\/\/\/cache\/material-sharing\/user-owner\//);
  assert.equal(s.files.get(staged), 'provider bytes'); assert.equal(s.files.get(provider), 'provider bytes');
  await s.discardMaterialFile('owner', staged);
  assert.equal(s.files.get(staged), 'provider bytes', 'the receiving app can still read the sharing cache');
  await assert.rejects(s.getShareableMaterialUri('owner', 'https://example.com'), /file or content/);
  await assert.rejects(s.getShareableMaterialUri(' ', localUri), /Sign in/);
});

test('failed sharing-cache copies remove partial files and surface the revoked-provider error', async () => {
  const s = await setup(); s.device.failCopy = true;
  const provider = 'content://provider/document/42'; s.files.set(provider, 'original provider bytes');
  await assert.rejects(s.getShareableMaterialUri('owner', provider, 'Notes.pdf'), /Storage full/);
  assert.equal([...s.files.keys()].some(uri => uri.startsWith('file:///cache/material-sharing/')), false);
  assert.equal(s.files.get(provider), 'original provider bytes');
});
