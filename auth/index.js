import AppwriteAuthService from './AppwriteAuthService';
import MockAuthService from './MockAuthService';

// Real Appwrite authentication. Set false only when using the local demo adapter.
export const USE_REAL_AUTH = false;

/** @type {import('./AuthService').default} */
export const authService = USE_REAL_AUTH ? new AppwriteAuthService() : new MockAuthService();

export default authService;
