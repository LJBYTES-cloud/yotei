const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const credentials = { email: 'student@yotei.demo', password: 'study12345' };
const publicUser = { id: 'student', name: 'Student', email: credentials.email };
const snapshot = value => JSON.parse(JSON.stringify(value));

function environment() {
  return {
    values: new Map(), available: true, storageFailure: null, failTrueWrite: false,
    remoteUser: null, deleteCode: null, getCode: null,
    deletes: 0, gets: 0, flagReads: 0,
    clients: [], creates: [], logins: [], logs: [], createError: null, sessionError: null,
    config: { APPWRITE_ENDPOINT: 'https://test.appwrite.io/v1', APPWRITE_PROJECT_ID: 'test-project', APPWRITE_PLATFORM: 'com.test.app' },
  };
}

// A fresh module graph represents a cold boot. SecureStore values and the SDK's
// cookie session are shared across boots, while adapter state is recreated.
async function coldBoot(state) {
  // The app entry installs the URL polyfill; isolated VM contexts need a URL too.
  const context = vm.createContext({ URL, console: { log: (...args) => state.logs.push(args) } });
  function synthetic(identifier, values) {
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context, identifier });
  }
  const secureStore = {
    isAvailableAsync: async () => state.available,
    getItemAsync: async key => {
      if (state.storageFailure === 'read') throw new Error('Storage read failed');
      if (key.includes('remember-me')) state.flagReads += 1;
      return state.values.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      if (state.storageFailure === 'write' || (state.failTrueWrite && value === 'true')) throw new Error('Storage write failed');
      state.values.set(key, value);
    },
    deleteItemAsync: async key => {
      if (state.storageFailure === 'delete') throw new Error('Storage delete failed');
      state.values.delete(key);
    },
  };
  class AppwriteException extends Error {
    constructor(code) { super(`Appwrite ${code}`); this.code = code; }
  }
  class Client {
    constructor() { this.config = {}; state.clients.push(this.config); }
    setEndpoint(value) { this.config.endpoint = value; return this; }
    setProject(value) { this.config.projectId = value; return this; }
    setPlatform(value) { this.config.platform = value; return this; }
  }
  class Account {
    async create(input) {
      state.creates.push(input);
      if (state.createError) throw state.createError;
    }
    async createEmailPasswordSession(input) {
      assert.deepEqual(Object.keys(input).sort(), ['email', 'password']);
      state.logins.push(input);
      if (state.sessionError) throw state.sessionError;
      if (input.password !== credentials.password) throw new AppwriteException(401);
      state.remoteUser = { ...publicUser, email: input.email };
    }
    async get() {
      state.gets += 1;
      if (state.getCode) throw new AppwriteException(state.getCode);
      if (!state.remoteUser) throw new AppwriteException(401);
      return { $id: state.remoteUser.id, name: state.remoteUser.name, email: state.remoteUser.email };
    }
    async deleteSession(input) {
      assert.equal(input.sessionId, 'current');
      state.deletes += 1;
      if (state.deleteCode) throw new AppwriteException(state.deleteCode);
      if (!state.remoteUser) throw new AppwriteException(401);
      state.remoteUser = null;
    }
  }
  const modules = new Map([
    ['expo-secure-store', synthetic('secure-store', secureStore)],
    ['react-native-appwrite', synthetic('sdk', { Account, AppwriteException, Client, ID: { unique: () => 'new-user' } })],
    [path.resolve('appwriteConfig.js'), synthetic('config', state.config)],
  ]);
  async function load(specifier, parent) {
    const identifier = specifier.startsWith('.')
      ? path.resolve(path.dirname(parent.identifier), specifier) + (path.extname(specifier) ? '' : '.js')
      : specifier;
    if (modules.has(identifier)) return modules.get(identifier);
    const module = new vm.SourceTextModule(fs.readFileSync(identifier, 'utf8'), { context, identifier });
    modules.set(identifier, module);
    await module.link(load);
    return module;
  }
  const parent = { identifier: path.resolve('test-entry.js') };
  const mock = await load('./auth/MockAuthService.js', parent);
  await mock.evaluate();
  const appwrite = await load('./auth/AppwriteAuthService.js', parent);
  await appwrite.evaluate();
  return { mock: new mock.namespace.default(), appwrite: new appwrite.namespace.default() };
}

test('Appwrite: normalized email reaches registration and login, with one correctly configured client', async () => {
  const state = environment();
  state.config = { APPWRITE_ENDPOINT: '  https://test.appwrite.io/v1/  ', APPWRITE_PROJECT_ID: ' test-project ', APPWRITE_PLATFORM: ' com.test.app ' };
  const auth = (await coldBoot(state)).appwrite;
  const email = '  STUDENT@YOTEI.DEMO\n';
  const user = await auth.signUp({ ...credentials, email, name: ' Student ' });
  assert.equal(user.email, credentials.email);
  assert.equal(state.creates[0].email, credentials.email);
  assert.equal(state.creates[0].name, 'Student');
  assert.equal(state.logins[0].email, credentials.email);
  assert.equal(state.logins[0].password, credentials.password);
  await auth.signOut();
  await auth.signIn({ ...credentials, email });
  assert.equal(state.logins[1].email, credentials.email);
  assert.deepEqual(state.clients, [{ endpoint: 'https://test.appwrite.io/v1', projectId: 'test-project', platform: 'com.test.app' }]);
  assert.equal(state.logs.filter(([label]) => label.includes('Client initialized')).length, 1);
  assert.equal(JSON.stringify(state.logs).includes(credentials.password), false);
});

test('Appwrite: duplicate-email signup logs exact details and propagates the original error', async () => {
  const state = environment();
  const error = Object.assign(new Error('A user with the same email already exists in this project.'), { code: 409, type: 'user_already_exists' });
  state.createError = error;
  const auth = (await coldBoot(state)).appwrite;
  await assert.rejects(auth.signUp({ ...credentials, name: 'Student' }), cause => cause === error);
  const log = state.logs.find(([label]) => label.includes('signUp failed'));
  assert.deepEqual(snapshot(log[1]), { code: error.code, message: error.message, type: error.type });
  assert.equal(state.logins.length, 0);
  assert.equal(auth.sessionEstablished, false);
});

test('Appwrite: rejected login logs its original Appwrite error before cleanup', async () => {
  const state = environment();
  const error = Object.assign(new Error('Invalid credentials. Please check the email and password.'), { code: 401, type: 'user_invalid_credentials' });
  state.sessionError = error;
  const auth = (await coldBoot(state)).appwrite;
  await assert.rejects(auth.signIn(credentials), cause => cause === error);
  const log = state.logs.find(([label]) => label.includes('signIn failed'));
  assert.deepEqual(snapshot(log[1]), { code: error.code, message: error.message, type: error.type });
  assert.equal(JSON.stringify(state.logs).includes(credentials.password), false);
  assert.equal(auth.sessionEstablished, false);
});

test('Appwrite: a login failure after registration rejects signup and logs both operations', async () => {
  const state = environment();
  const error = Object.assign(new Error('Email/password login is disabled.'), { code: 501, type: 'user_auth_method_unsupported' });
  state.sessionError = error;
  const auth = (await coldBoot(state)).appwrite;
  await assert.rejects(auth.signUp({ ...credentials, name: 'Student' }), cause => cause === error);
  assert.equal(state.creates.length, 1);
  for (const operation of ['signIn', 'signUp']) {
    const log = state.logs.find(([label]) => label.includes(`${operation} failed`));
    assert.deepEqual(snapshot(log[1]), { code: error.code, message: error.message, type: error.type });
  }
});

test('Appwrite: incomplete or malformed configuration is rejected before creating a client', async () => {
  for (const config of [
    { APPWRITE_PROJECT_ID: ' ' },
    { APPWRITE_PLATFORM: ' ' },
    { APPWRITE_ENDPOINT: 'not-a-url' },
    { APPWRITE_ENDPOINT: 'https://test.appwrite.io' },
    { APPWRITE_ENDPOINT: 'https://test.appwrite.io/v1?project=wrong' },
  ]) {
    const state = environment();
    Object.assign(state.config, config);
    const auth = (await coldBoot(state)).appwrite;
    await assert.rejects(auth.signIn(credentials), /APPWRITE_ENDPOINT|appwriteConfig/);
    assert.equal(state.clients.length, 0);
    assert.equal(state.logins.length, 0);
    assert.ok(state.logs.some(([label, details]) => label.includes('signIn failed') && details.message));
  }
});

for (const provider of ['mock', 'appwrite']) {
  test(`${provider}: default-off session remains usable during this launch and clears on cold boot`, async () => {
    const state = environment();
    const auth = (await coldBoot(state))[provider];
    const user = await auth.signIn(credentials);
    assert.equal(state.values.get(auth.rememberMeKey), 'false');
    assert.deepEqual(snapshot(await auth.getCurrentUser()), snapshot(user));
    assert.deepEqual(snapshot(await auth.getCurrentUser()), snapshot(user));
    const restarted = (await coldBoot(state))[provider];
    const beforeDeletes = state.deletes;
    const beforeReads = state.flagReads;
    assert.deepEqual(await Promise.all([restarted.getCurrentUser(), restarted.getCurrentUser()]), [null, null]);
    assert.equal(state.flagReads - beforeReads, 1);
    if (provider === 'appwrite') {
      assert.equal(state.deletes - beforeDeletes, 1);
      assert.equal(state.remoteUser, null);
    } else assert.equal(state.values.has('yotei.mock-auth.session.v1'), false);
  });

  test(`${provider}: remembered login survives cold boot and sign-out clears it`, async () => {
    const state = environment();
    const auth = (await coldBoot(state))[provider];
    const user = await auth.signIn({ ...credentials, rememberMe: true });
    assert.equal(state.values.get(auth.rememberMeKey), 'true');
    assert.equal([...state.values.values()].some(value => value.includes(credentials.password)), false);
    const restarted = (await coldBoot(state))[provider];
    assert.deepEqual(snapshot(await restarted.getCurrentUser()), snapshot(user));
    await restarted.signOut();
    assert.equal(state.values.get(auth.rememberMeKey), 'false');
    assert.equal(await restarted.getCurrentUser(), null);
    assert.equal(await (await coldBoot(state))[provider].getCurrentUser(), null);
  });

  test(`${provider}: sign-up passes through both remember choices`, async () => {
    for (const rememberMe of [false, true]) {
      const state = environment();
      const auth = (await coldBoot(state))[provider];
      const user = await auth.signUp({ ...credentials, email: 'new@yotei.demo', name: 'New Student', rememberMe });
      assert.equal(state.values.get(auth.rememberMeKey), String(rememberMe));
      assert.deepEqual(snapshot(await auth.getCurrentUser()), snapshot(user));
      const restored = await (await coldBoot(state))[provider].getCurrentUser();
      assert.deepEqual(snapshot(restored), rememberMe ? snapshot(user) : null);
    }
  });

  test(`${provider}: storage errors block restoration and can be retried`, async () => {
    const state = environment();
    const auth = (await coldBoot(state))[provider];
    await auth.signIn({ ...credentials, rememberMe: true });
    const restarted = (await coldBoot(state))[provider];
    state.storageFailure = 'read';
    await assert.rejects(restarted.getCurrentUser(), /Storage read failed/);
    state.storageFailure = null;
    assert.equal((await restarted.getCurrentUser()).email, credentials.email);
  });

  test(`${provider}: a failed remember write never creates a remembered login`, async () => {
    const state = environment();
    state.failTrueWrite = true;
    const auth = (await coldBoot(state))[provider];
    await assert.rejects(auth.signIn({ ...credentials, rememberMe: true }), /Storage write failed/);
    assert.equal(state.values.get(auth.rememberMeKey), 'false');
    assert.equal(await auth.getCurrentUser(), null);
    assert.equal(await (await coldBoot(state))[provider].getCurrentUser(), null);
    if (provider === 'appwrite') assert.equal(state.remoteUser, null);
  });

  test(`${provider}: turning remembering off after a remembered login takes effect on the next boot`, async () => {
    const state = environment();
    await (await coldBoot(state))[provider].signIn({ ...credentials, rememberMe: true });
    const auth = (await coldBoot(state))[provider];
    assert.ok(await auth.getCurrentUser());
    await auth.signOut();
    await auth.signIn({ ...credentials, rememberMe: false });
    assert.ok(await auth.getCurrentUser());
    assert.equal(await (await coldBoot(state))[provider].getCurrentUser(), null);
  });

  test(`${provider}: failed sign-out disarms remembering and cold-boot cleanup is retryable`, async () => {
    const state = environment();
    const auth = (await coldBoot(state))[provider];
    await auth.signIn({ ...credentials, rememberMe: true });
    if (provider === 'mock') state.storageFailure = 'delete';
    else state.deleteCode = 500;
    await assert.rejects(auth.signOut());
    assert.equal(state.values.get(auth.rememberMeKey), 'false');
    const restarted = (await coldBoot(state))[provider];
    await assert.rejects(restarted.getCurrentUser());
    state.storageFailure = null;
    state.deleteCode = null;
    assert.equal(await restarted.getCurrentUser(), null);
  });

  test(`${provider}: platforms without SecureStore allow a memory-only login`, async () => {
    const state = environment();
    state.available = false;
    const auth = (await coldBoot(state))[provider];
    await auth.signIn(credentials);
    assert.equal((await auth.getCurrentUser()).email, credentials.email);
    assert.equal(state.values.size, 0);
    assert.equal(await (await coldBoot(state))[provider].getCurrentUser(), null);
    await assert.rejects(auth.signIn({ ...credentials, rememberMe: true }), /iOS and Android/);
  });
}

test('Appwrite: failed cold-boot revocation blocks account access and retries once', async () => {
  const state = environment();
  state.remoteUser = publicUser;
  state.deleteCode = 500;
  const auth = (await coldBoot(state)).appwrite;
  await assert.rejects(auth.getCurrentUser(), /Appwrite 500/);
  assert.equal(state.gets, 0);
  state.deleteCode = null;
  const beforeDeletes = state.deletes;
  assert.deepEqual(await Promise.all([auth.getCurrentUser(), auth.getCurrentUser()]), [null, null]);
  assert.equal(state.deletes - beforeDeletes, 1);
  assert.equal(state.remoteUser, null);
});

test('Appwrite: an expired remembered session clears the remembered flag', async () => {
  const state = environment();
  const auth = (await coldBoot(state)).appwrite;
  await auth.signIn({ ...credentials, rememberMe: true });
  state.remoteUser = null;
  const restarted = (await coldBoot(state)).appwrite;
  assert.equal(await restarted.getCurrentUser(), null);
  assert.equal(state.values.get(auth.rememberMeKey), 'false');
});

test('legacy or malformed flags do not restore sessions; provider flags stay separate', async () => {
  for (const flag of [undefined, 'false', 'invalid']) {
    const state = environment();
    const first = await coldBoot(state);
    state.values.set('yotei.mock-auth.session.v1', JSON.stringify(publicUser));
    state.remoteUser = publicUser;
    if (flag !== undefined) {
      state.values.set(first.mock.rememberMeKey, flag);
      state.values.set(first.appwrite.rememberMeKey, flag);
    }
    assert.equal(await first.mock.getCurrentUser(), null);
    assert.equal(await first.appwrite.getCurrentUser(), null);
  }
  const state = environment();
  const first = await coldBoot(state);
  await first.mock.signIn({ ...credentials, rememberMe: true });
  state.remoteUser = publicUser;
  const second = await coldBoot(state);
  assert.equal(await second.appwrite.getCurrentUser(), null);
  assert.equal((await second.mock.getCurrentUser()).email, credentials.email);
});
