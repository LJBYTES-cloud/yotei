/**
 * @typedef {{ id: string, name: string, email: string }} AuthUser
 * @typedef {{ email: string, password: string }} SignInCredentials
 * @typedef {{ name: string, email: string, password: string }} SignUpCredentials
 */

export default class AuthService {
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
