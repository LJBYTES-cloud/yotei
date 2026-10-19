import * as SecureStore from 'expo-secure-store';

/**
 * @typedef {{ id: string, name: string, email: string }} AuthUser
 * @typedef {{ email: string, password: string, rememberMe?: boolean }} SignInCredentials
 * @typedef {{ name: string, email: string, password: string, rememberMe?: boolean }} SignUpCredentials
 */

export default class AuthService {
  /** @param {string} [provider] */
  constructor(provider = 'auth') {
    this.rememberMeKey = `yotei.${provider}.remember-me.v1`;
    /** @type {Promise<boolean> | null} */
    this.startupPromise = null;
    this.sessionEstablished = false;
  }

  /**
   * Run once for this app launch, including concurrent restoration calls.
   * Missing/invalid flags require a fresh login, as does an explicit false.
   * Cleanup failures remain retryable and never expose the previous session.
   * @returns {Promise<boolean>}
   */
  initializeSession() {
    if (!this.startupPromise) {
      this.startupPromise = (async () => {
        const available = await SecureStore.isAvailableAsync();
        const rememberMe = available && await SecureStore.getItemAsync(this.rememberMeKey) === 'true';
        if (!rememberMe) await this.signOut();
        return rememberMe;
      })().catch(error => {
        this.startupPromise = null;
        throw error;
      });
    }
    return this.startupPromise;
  }

  /** @param {boolean} rememberMe */
  async saveRememberMe(rememberMe) {
    if (typeof rememberMe !== 'boolean') throw new Error('Remember me must be true or false.');
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(this.rememberMeKey, String(rememberMe));
    } else if (rememberMe) {
      throw new Error('Remember me is available in the iOS and Android app.');
    }
  }

  /** @param {SignUpCredentials} credentials @returns {Promise<AuthUser>} */
  async signUp(credentials) {
    throw new Error('AuthService.signUp must be implemented.');
  }

  /** @param {SignInCredentials} credentials @returns {Promise<AuthUser>} */
  async signIn(credentials) {
    throw new Error('AuthService.signIn must be implemented.');
  }

  /** @returns {Promise<void>} */
  async signOut() {
    throw new Error('AuthService.signOut must be implemented.');
  }

  /** @returns {Promise<AuthUser | null>} */
  async getCurrentUser() {
    throw new Error('AuthService.getCurrentUser must be implemented.');
  }
}
