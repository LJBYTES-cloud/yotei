import { Account, AppwriteException, Client, ID } from 'react-native-appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PLATFORM, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import AuthService from './AuthService';

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
      if (APPWRITE_ENDPOINT.includes('YOUR_') || APPWRITE_PROJECT_ID === 'YOUR_PROJECT_ID' ||
          APPWRITE_PLATFORM === 'com.yourcompany.yotei') {
        throw new Error('Fill in appwriteConfig.js before enabling real authentication.');
      }
      const client = new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID)
        .setPlatform(APPWRITE_PLATFORM);
      this.account = new Account(client);
    }
    return this.account;
  }

  /** @param {import('./AuthService').SignUpCredentials} credentials */
  async signUp({ name, email, password, rememberMe = false }) {
    await this.initializeSession();
    await this.getAccount().create({
      userId: ID.unique(),
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
    });
    // Both adapters sign the user in immediately after account creation.
    return this.signIn({ email, password, rememberMe });
  }

  /** @param {import('./AuthService').SignInCredentials} credentials */
  async signIn({ email, password, rememberMe = false }) {
    await this.initializeSession();
    const account = this.getAccount();
    await this.saveRememberMe(false);
    try {
      await account.createEmailPasswordSession({ email: email.trim().toLowerCase(), password });
      const user = normalizeUser(await account.get());
      await this.saveRememberMe(rememberMe);
      this.sessionEstablished = true;
      return user;
    } catch (error) {
      // A failed preference write or account fetch must not leave a new login
      // active behind the error screen. The stored false flag also protects
      // the next startup if a network failure prevents this cleanup.
      await this.clearRemoteSession().catch(() => {});
      this.sessionEstablished = false;
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
