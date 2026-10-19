import * as SecureStore from 'expo-secure-store';
import AuthService from './AuthService';

const SESSION_KEY = 'yotei.mock-auth.session.v1';
export const DEMO_EMAIL = 'student@yotei.demo';
export const DEMO_PASSWORD = 'study12345';

/** @typedef {import('./AuthService').AuthUser} AuthUser */

/** @param {AuthUser} user @returns {AuthUser} */
const publicUser = ({ id, name, email }) => ({ id, name, email });

// Development-only fake authentication. Credentials never leave memory.
export default class MockAuthService extends AuthService {
  constructor() {
    super();
    this.users = new Map([
      [DEMO_EMAIL, { id: 'demo-student', name: 'Student', email: DEMO_EMAIL, password: DEMO_PASSWORD }],
    ]);
    /** @type {AuthUser | null} */
    this.currentUser = null;
  }

  /** @param {AuthUser} user */
  async saveSession(user) {
    const sessionUser = publicUser(user);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sessionUser));
    }
    // On platforms without SecureStore (web), the demo session is memory-only.
    this.currentUser = sessionUser;
    return { ...sessionUser };
  }

  /** @param {import('./AuthService').SignUpCredentials} credentials */
  async signUp({ name, email, password }) {
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
    const session = await this.saveSession(user);
    this.users.set(normalizedEmail, user);
    return session;
  }

  /** @param {import('./AuthService').SignInCredentials} credentials */
  async signIn({ email, password }) {
    const user = this.users.get(email.trim().toLowerCase());
    if (!user || user.password !== password) {
      throw new Error('The email or password is incorrect. Please try again.');
    }
    return this.saveSession(user);
  }

  async signOut() {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    this.currentUser = null;
  }

  async getCurrentUser() {
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
    return { ...this.currentUser };
  }
}
