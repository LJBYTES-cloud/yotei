// Metro selects this module on web, excluding expo-sqlite and its WASM loader.
// Keep the native database.js API without pretending browser storage is saved.
export function getDatabase() {
  return Promise.reject(new Error('Study storage is available in the Android and iOS app.'));
}

/** @param {string} userId */
export function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Sign in before accessing your study space.');
  }
}
