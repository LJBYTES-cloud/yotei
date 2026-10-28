import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateTime, formatTime } from './utils/timeFormat';

const KEY = 'yotei.time-format.v1';
/** @typedef {{is24Hour: boolean, set24Hour: (value: boolean) => void, formatTime: (value: string | number | Date) => string, formatDateTime: (value: string | number | Date) => string}} TimePreference */
const TimeFormatContext = createContext(/** @type {TimePreference | null} */ (null));

/** @param {{children: import('react').ReactNode, fallback?: import('react').ReactNode}} props */
export function TimeFormatProvider({ children, fallback = null }) {
  const [is24Hour, setIs24Hour] = useState(true), [ready, setReady] = useState(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(KEY).then(saved => { if (active) setIs24Hour(saved !== '12'); })
      .catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const set24Hour = useCallback((/** @type {boolean} */ value) => {
    setIs24Hour(value);
    queue.current = queue.current.then(() => AsyncStorage.setItem(KEY, value ? '24' : '12')).catch(() => {});
  }, []);
  const preference = useMemo(() => ({ is24Hour, set24Hour,
    formatTime: (/** @type {string | number | Date} */ value) => formatTime(value, is24Hour),
    formatDateTime: (/** @type {string | number | Date} */ value) => formatDateTime(value, is24Hour),
  }), [is24Hour, set24Hour]);
  return ready ? <TimeFormatContext.Provider value={preference}>{children}</TimeFormatContext.Provider> : fallback;
}

export function useTimeFormat() {
  const preference = useContext(TimeFormatContext);
  if (!preference) throw new Error('useTimeFormat must be used inside TimeFormatProvider.');
  return preference;
}
