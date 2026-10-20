import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authService } from './index';

/** @typedef {import('./AuthService').AuthUser} AuthUser */
/** @typedef {{ user: AuthUser | null, restoring: boolean, restoreError: string, retryRestore: () => void, acceptUser: (user: AuthUser) => void, signingOut: boolean, signOutError: string, signOut: () => Promise<void> }} SessionValue */
const SessionContext = createContext(/** @type {SessionValue | null} */ (null));

/** @param {{children: import('react').ReactNode}} props */
export function SessionProvider({ children }) {
  const [user, setUser] = useState(/** @type {AuthUser | null} */ (null));
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    setRestoring(true); setRestoreError('');
    void authService.getCurrentUser().then(current => {
      if (active) setUser(current);
    }).catch(() => {
      if (active) setRestoreError('We couldn’t restore your session. Please try again.');
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [attempt]);

  async function signOut() {
    if (submitting.current) return;
    submitting.current = true; setSigningOut(true); setSignOutError('');
    try {
      await authService.signOut();
      setUser(null);
    } catch {
      setSignOutError('We couldn’t sign you out. Please try again.');
    } finally { submitting.current = false; setSigningOut(false); }
  }

  return <SessionContext.Provider value={{ user, restoring, restoreError, retryRestore: () => setAttempt(value => value + 1), acceptUser: setUser, signingOut, signOutError, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
