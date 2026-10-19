import AppwriteAuthService from './AppwriteAuthService';
import MockAuthService from './MockAuthService';

// Fill in appwriteConfig.js, then flip this flag to use Appwrite.
export const USE_REAL_AUTH = false;

/** @type {import('./AuthService').default} */
export const authService = USE_REAL_AUTH ? new AppwriteAuthService() : new MockAuthService();

export default authService;
