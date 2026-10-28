import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Readiness/date labels tick only on a focused screen, never in shared state.
 * The actual focus timer owns its separate one-second clock.
 */
export function useScreenClock() {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    let timer = /** @type {ReturnType<typeof setInterval> | null} */ (null);
    const sync = (/** @type {import('react-native').AppStateStatus | null} */ state) => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (state === 'active' || state === null) {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 30_000);
      }
    };
    sync(AppState.currentState);
    const listener = AppState.addEventListener('change', sync);
    return () => { if (timer !== null) clearInterval(timer); listener.remove(); };
  }, []));
  return now;
}
