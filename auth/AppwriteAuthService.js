import { Account, AppwriteException, Client, ID } from 'react-native-appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PLATFORM, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import AuthService from './AuthService';

/** @param {{ $id: string, name: string, email: string }} user */
const normalizeUser = (user) => ({ id: user.$id, name: user.name, email: user.email });

export default class AppwriteAuthService extends AuthService {
  constructor() {
    super();
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
  async signUp({ name, email, password }) {
    await this.getAccount().create({
      userId: ID.unique(),
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
    });
    // Both adapters sign the user in immediately after account creation.
    return this.signIn({ email, password });
  }

  /** @param {import('./AuthService').SignInCredentials} credentials */
  async signIn({ email, password }) {
    const account = this.getAccount();
    await account.createEmailPasswordSession({ email: email.trim().toLowerCase(), password });
    return normalizeUser(await account.get());
  }

  async signOut() {
    try {
      await this.getAccount().deleteSession({ sessionId: 'current' });
    } catch (error) {
      // An already expired session is also signed out.
      if (!(error instanceof AppwriteException) || error.code !== 401) throw error;
    }
  }

  async getCurrentUser() {
    try {
      return normalizeUser(await this.getAccount().get());
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 401) return null;
      throw error;
    }
  }
}
