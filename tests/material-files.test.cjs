const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

async function setup() {
  const files = new Map([['file:///cache/picked.pdf', 'original document']]), calls = [];
  const device = { canceled: false, failCopy: false };
  const join = parts => parts.map(part => typeof part === 'string' ? part : part.uri).reduce((uri, part) => uri ? `${uri.replace(/\/$/, '')}/${part}` : part, '');
  class Directory {
    constructor(...parts) { this.uri = new URL(join(parts)).href; }
    async create(options) { calls.push(['create', this.uri, options]); }
  }
  class File {
    constructor(...parts) { this.uri = new URL(join(parts)).href; }
    get exists() { return files.has(this.uri); }
    async copy(destination) {
      calls.push(['copy', this.uri, destination.uri]);
      assert.equal(files.has(this.uri), true);
      files.set(destination.uri, files.get(this.uri));
      if (device.failCopy) throw new Error('Storage full');
    }
    async delete() { calls.push(['delete', this.uri]); files.delete(this.uri); }
  }
  const context = vm.createContext({});
  const module = new vm.SourceTextModule(fs.readFileSync('utils/materialFiles.js', 'utf8'), { context });
  const mocks = {
    'expo-file-system': { Directory, File, Paths: { document: new Directory('file:///documents') } },
    'expo-document-picker': { getDocumentAsync: async options => {
      calls.push(['pick', options]);
      return device.canceled ? { canceled: true, assets: null } : { canceled: false, assets: [{ uri: 'file:///cache/picked.pdf', name: '../Week 1.pdf' }] };
    } },
  };
  await module.link(name => new vm.SyntheticModule(Object.keys(mocks[name]), function () { for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value); }, { context }));
  await module.evaluate();
  return { ...module.namespace, files, calls, device };
}

test('picked documents copy into permanent, account-scoped storage and survive clearing picker cache', async () => {
  const s = await setup();
  const picked = await s.pickMaterialFile('owner');
  assert.match(picked.uri, /^file:\/\/\/documents\/materials\/user-owner\//);
  assert.equal(s.files.get(picked.uri), 'original document');
  assert.equal(s.calls[0][1].copyToCacheDirectory, true);
  assert.equal(s.calls[0][1].multiple, false);
  s.files.delete('file:///cache/picked.pdf');
  assert.equal(s.files.get(picked.uri), 'original document');
});

test('picker cancellation changes no files; copy failure removes only the partial app copy', async () => {
  const s = await setup(); s.device.canceled = true;
  assert.equal(await s.pickMaterialFile('owner'), null);
  assert.equal(s.calls.some(call => call[0] === 'copy'), false);
  s.device.canceled = false; s.device.failCopy = true;
  await assert.rejects(s.pickMaterialFile('owner'), /Storage full/);
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
