import { Account, AppwriteException, Client, ID } from 'react-native-appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PLATFORM, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import AuthService, { normalizeDisplayName } from './AuthService';

/** @param {{ $id: string, name: string, email: string }} user */
const normalizeUser = (user) => ({ id: user.$id, name: user.name, email: user.email });

export default class AppwriteAuthService extends AuthService {
  constructor() {
    super('appwrite-auth');
    /** @type {Account | null} */
    this.account = null;
  }

  getAccount() {
    // Lazy setup keeps placeholder configuration harmless in mock mode.
    if (!this.account) {
      const endpoint = APPWRITE_ENDPOINT.trim().replace(/\/+$/, '');
      const projectId = APPWRITE_PROJECT_ID.trim();
      const platform = APPWRITE_PLATFORM.trim();
      if (!endpoint || !projectId || !platform || endpoint.includes('YOUR_') || projectId === 'YOUR_PROJECT_ID' ||
          platform === 'com.yourcompany.yotei') {
        throw new Error('Fill in appwriteConfig.js before enabling real authentication.');
      }
      let endpointUrl;
      try { endpointUrl = new URL(endpoint); }
      catch { throw new Error('APPWRITE_ENDPOINT must be a valid Appwrite API URL ending in /v1.'); }
      if (!['https:', 'http:'].includes(endpointUrl.protocol) || !endpointUrl.pathname.endsWith('/v1') || endpointUrl.search || endpointUrl.hash) {
        throw new Error('APPWRITE_ENDPOINT must be an HTTP(S) Appwrite API URL ending in /v1, without query parameters or a fragment.');
      }
      const client = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setPlatform(platform);
      this.account = new Account(client);
      console.log('[AppwriteAuthService] Client initialized', { endpoint, projectId, platform });
    }
    return this.account;
  }

  /** @param {import('./AuthService').SignUpCredentials} credentials */
  async signUp({ name, email, password, rememberMe = false }) {
    try {
      await this.initializeSession();
      const normalizedEmail = email.trim().toLowerCase();
      await this.getAccount().create({
        userId: ID.unique(),
        email: normalizedEmail,
        password,
        name: name.trim(),
      });
      // Await so post-registration login failures are also logged and reach the UI.
      return await this.signIn({ email: normalizedEmail, password, rememberMe });
    } catch (error) {
      const cause = /** @type {Partial<AppwriteException> | null | undefined} */ (error);
      console.log('[AppwriteAuthService] signUp failed', { code: cause?.code, message: cause?.message, type: cause?.type });
      throw error;
    }
  }

  /** @param {import('./AuthService').SignInCredentials} credentials */
  async signIn({ email, password, rememberMe = false }) {
    let sessionAttempted = false;
    try {
      await this.initializeSession();
      const account = this.getAccount();
      await this.saveRememberMe(false);
      sessionAttempted = true;
      await account.createEmailPasswordSession({ email: email.trim().toLowerCase(), password });
      const user = normalizeUser(await account.get());
      await this.saveRememberMe(rememberMe);
      this.sessionEstablished = true;
      return user;
    } catch (error) {
      const cause = /** @type {Partial<AppwriteException> | null | undefined} */ (error);
      console.log('[AppwriteAuthService] signIn failed', { code: cause?.code, message: cause?.message, type: cause?.type });
      // A failed preference write or account fetch must not leave a new login
      // active behind the error screen. The stored false flag also protects
      // the next startup if a network failure prevents this cleanup.
      if (sessionAttempted) {
        await this.clearRemoteSession().catch(() => {});
        this.sessionEstablished = false;
      }
      throw error;
    }
  }

  async clearRemoteSession() {
    try {
      await this.getAccount().deleteSession({ sessionId: 'current' });
    } catch (error) {
      // An already expired session is also signed out.
      if (!(error instanceof AppwriteException) || error.code !== 401) throw error;
    }
  }

  /** @param {string} name */
  async updateName(name) {
    const normalized = normalizeDisplayName(name);
    await this.initializeSession();
    if (!this.sessionEstablished && !await this.getCurrentUser()) throw new Error('Sign in before updating your name.');
    return normalizeUser(await this.getAccount().updateName({ name: normalized }));
  }

  async signOut() {
    // Write first so a failed revocation will be retried on the next startup.
    await this.saveRememberMe(false);
    await this.clearRemoteSession();
    this.sessionEstablished = false;
  }

  async getCurrentUser() {
    const restoreAllowed = await this.initializeSession();
    if (!restoreAllowed && !this.sessionEstablished) return null;
    try {
      const user = normalizeUser(await this.getAccount().get());
      this.sessionEstablished = true;
      return user;
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 401) {
        await this.saveRememberMe(false);
        this.sessionEstablished = false;
        return null;
      }
      throw error;
    }
  }
}
