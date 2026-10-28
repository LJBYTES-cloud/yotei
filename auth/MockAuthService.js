import * as SecureStore from 'expo-secure-store';
import AuthService, { normalizeDisplayName } from './AuthService';

const SESSION_KEY = 'yotei.mock-auth.session.v1';
export const DEMO_EMAIL = 'student@yotei.demo';
export const DEMO_PASSWORD = 'study12345';

/** @typedef {import('./AuthService').AuthUser} AuthUser */

/** @param {AuthUser} user @returns {AuthUser} */
const publicUser = ({ id, name, email }) => ({ id, name, email });

// Development-only fake authentication. Credentials never leave memory.
export default class MockAuthService extends AuthService {
  constructor() {
    super('mock-auth');
    this.users = new Map([
      [DEMO_EMAIL, { id: 'demo-student', name: 'Student', email: DEMO_EMAIL, password: DEMO_PASSWORD }],
    ]);
    /** @type {AuthUser | null} */
    this.currentUser = null;
  }

  /** @param {AuthUser} user @param {boolean} rememberMe */
  async saveSession(user, rememberMe) {
    await this.initializeSession();
    const sessionUser = publicUser(user);
    // Disarm any previous remembered session before replacing it. A failed
    // session/flag write must not leave a newly created session remembered.
    await this.saveRememberMe(false);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sessionUser));
    }
    await this.saveRememberMe(rememberMe);
    // On platforms without SecureStore (web), the demo session is memory-only.
    this.currentUser = sessionUser;
    this.sessionEstablished = true;
    return { ...sessionUser };
  }

  /** @param {import('./AuthService').SignUpCredentials} credentials */
  async signUp({ name, email, password, rememberMe = false }) {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 128) {
      throw new Error('Enter a name between 1 and 128 characters.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Enter a valid email address.');
    }
    if (password.length < 8 || password.length > 256) {
      throw new Error('Use a password between 8 and 256 characters.');
    }
    if (this.users.has(normalizedEmail)) {
      throw new Error('An account with this email already exists. Please sign in.');
    }
    const user = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: trimmedName,
      email: normalizedEmail,
      password,
    };
    const session = await this.saveSession(user, rememberMe);
    this.users.set(normalizedEmail, user);
    return session;
  }

  /** @param {import('./AuthService').SignInCredentials} credentials */
  async signIn({ email, password, rememberMe = false }) {
    const user = this.users.get(email.trim().toLowerCase());
    if (!user || user.password !== password) {
      throw new Error('The email or password is incorrect. Please try again.');
    }
    return this.saveSession(user, rememberMe);
  }

  async signOut() {
    await this.saveRememberMe(false);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    this.currentUser = null;
    this.sessionEstablished = false;
  }

  /** Update public session storage without changing the remember-me choice.
   * @param {string} name
   */
  async updateName(name) {
    const normalized = normalizeDisplayName(name), user = await this.getCurrentUser();
    if (!user) throw new Error('Sign in before updating your name.');
    const updated = { ...user, name: normalized };
    if (await SecureStore.isAvailableAsync()) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(updated));
    const credentials = this.users.get(user.email);
    if (credentials?.id === user.id) this.users.set(user.email, { ...credentials, name: normalized });
    this.currentUser = updated;
    return { ...updated };
  }

  async getCurrentUser() {
    const restoreAllowed = await this.initializeSession();
    if (!restoreAllowed && !this.sessionEstablished) return null;
    if (!(await SecureStore.isAvailableAsync())) {
      return this.currentUser ? { ...this.currentUser } : null;
    }
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    if (!stored) {
      this.currentUser = null;
      return null;
    }
    // Parse errors are recoverable; storage failures must reach the UI.
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id ||
        typeof parsed.name !== 'string' || !parsed.name ||
        typeof parsed.email !== 'string' || !parsed.email) {
      await this.signOut();
      return null;
    }
    // Restore the public session, never the in-memory password database.
    this.currentUser = publicUser(parsed);
    const credentials = this.users.get(this.currentUser.email);
    if (credentials?.id === this.currentUser.id) this.users.set(this.currentUser.email, { ...credentials, name: this.currentUser.name });
    this.sessionEstablished = true;
    return { ...this.currentUser };
  }
}
