import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { USE_REAL_AUTH } from '../auth';
import { useSession } from '../auth/SessionContext';
import { getLocalDateKey } from '../db/dateUtils';
import { updateStudyBlockStatus } from '../db/StudyBlockService';
import { seedDemoData } from '../db/seedData';
import { createReviewItem, markReviewed } from '../db/ReviewService';
import { useDashboardData } from '../hooks/useDashboardData';
import EntrySheet from './EntrySheet';
import ScheduleSheet from './ScheduleSheet';
import { formatTime } from './theme';

/** @typedef {import('../db/StudyBlockService').StudyBlock} StudyBlock */
/** @typedef {{task: {id: number, title: string, subject_name: string}, sourceBlock?: StudyBlock, initialDuration?: number}} Schedule */
const StudyContext = createContext(/** @type {ReturnType<typeof useWorkspaceState> | null} */ (null));

/** @param {import('../auth/AuthService').AuthUser} user */
function useWorkspaceState(user) {
  const { signingOut, signOut, signOutError } = useSession();
  const [clock, setClock] = useState(() => Date.now());
  const [today, setToday] = useState(() => getLocalDateKey());
  const data = useDashboardData(user.id, today);
  const { blocks, refresh } = data;
  const [entry, setEntry] = useState(/** @type {'task' | 'subject' | null} */ (null));
  const [initialSubject, setInitialSubject] = useState(/** @type {number | null} */ (null));
  const [schedule, setSchedule] = useState(/** @type {Schedule | null} */ (null));
  const [workingBlock, setWorkingBlock] = useState(/** @type {number | null} */ (null));
  const [addingReview, setAddingReview] = useState(false);
  const [workingReview, setWorkingReview] = useState(/** @type {{id: number, difficulty: import('../db/ReviewService').ReviewDifficulty} | null} */ (null));
  const [seeding, setSeeding] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const mutation = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const busy = signingOut || workingBlock !== null || seeding || addingReview || workingReview !== null;
  const disabled = busy || !data.ready || data.refreshing;
  const blocked = busy || entry !== null || schedule !== null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { busyRef.current = blocked; }, [blocked]);
  useEffect(() => {
    const tick = (foreground = false) => {
      const now = new Date();
      const date = getLocalDateKey(now);
      setClock(now.getTime()); setToday(date);
      const expired = blocks.some(block => block.status === 'scheduled' && Date.parse(block.end_time) < now.getTime());
      if (!busyRef.current && date === today && (foreground || expired)) void refresh(true);
    };
    const interval = setInterval(() => tick(), 30_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(true); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [blocks, refresh, today]);

  const refreshData = useCallback(() => { if (!busyRef.current) void refresh(); }, [refresh]);
  const refreshInBackground = useCallback(() => { if (!busyRef.current) void refresh(true); }, [refresh]);

  /** @param {{subject_id: number, topic: string}} input @returns {Promise<boolean>} */
  async function addReview(input) {
    if (mutation.current || disabled || busyRef.current) return false;
    mutation.current = true; busyRef.current = true; setAddingReview(true); setActionError(''); setNotice('');
    try {
      await createReviewItem(user.id, input);
      if (!mounted.current) return false;
      setNotice('Topic added to the review queue.');
      await data.refresh();
      return true;
    } catch {
      if (mounted.current) setActionError('Could not add the review topic. Check the subject and try again.');
      return false;
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setAddingReview(false); }
  }

  /** @param {number} id @param {import('../db/ReviewService').ReviewDifficulty} difficulty */
  async function review(id, difficulty) {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setWorkingReview({ id, difficulty }); setActionError(''); setNotice('');
    try {
      const item = await markReviewed(user.id, id, difficulty);
      if (!mounted.current) return;
      setNotice(`Review saved. Next review: ${new Date(/** @type {string} */ (item.next_review_at)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`);
      await data.refresh();
    } catch {
      if (mounted.current) setActionError('Could not save the review. Refresh the queue and try again.');
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setWorkingReview(null); }
  }

  /** @param {number} id */
  async function complete(id) {
    if (mutation.current || disabled) return;
    mutation.current = true; busyRef.current = true; setWorkingBlock(id); setActionError('');
    try {
      await updateStudyBlockStatus(user.id, id, 'done');
      if (!mounted.current) return;
      setNotice('Session marked done.');
      await data.refresh();
    } catch { if (mounted.current) setActionError('We couldn’t update that session. Pull down to refresh, then try again.'); }
    finally { mutation.current = false; busyRef.current = false; if (mounted.current) setWorkingBlock(null); }
  }

  async function loadDemoData() {
    if (USE_REAL_AUTH || mutation.current || disabled || entry || schedule) return;
    mutation.current = true; busyRef.current = true; setSeeding(true); setActionError(''); setNotice('');
    try {
      await seedDemoData(user.id);
      if (!mounted.current) return;
      setClock(Date.now()); setToday(getLocalDateKey());
      await data.refresh();
      if (mounted.current) {
        setDemoRevision(value => value + 1);
        setNotice('Demo ready: 3 subjects, 6 tasks, and 4h today. Schedule a task to try the workload warning.');
        router.navigate('/');
      }
    } catch {
      if (mounted.current) setActionError('Demo data couldn’t load. Your previous study data is unchanged; please try again.');
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setSeeding(false); }
  }

  /** @param {StudyBlock} block */
  function savedSession(block) {
    setSchedule(null); setActionError('');
    const dateLabel = getLocalDateKey(new Date(block.start_time)) === today ? '' : `${new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, `;
    setNotice(`Session scheduled: ${dateLabel}${formatTime(block.start_time)}–${formatTime(block.end_time)}.`);
    void data.refresh();
    router.navigate('/');
  }

  /** @param {{id: number, title: string, subject_name: string}} task @param {number} [minutes] */
  function openSchedule(task, minutes = 30) {
    if (disabled || busyRef.current) return;
    busyRef.current = true; setActionError(''); setSchedule({ task, initialDuration: minutes });
  }
  /** @param {StudyBlock} block */
  function openReschedule(block) {
    if (disabled || busyRef.current) return;
    busyRef.current = true; setActionError('');
    setSchedule({ task: { id: block.task_id, title: block.task_title, subject_name: block.subject_name }, sourceBlock: block,
      initialDuration: Math.max(1, Math.round((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000)) });
  }
  /** @param {'subject' | 'task'} kind @param {number | null} [subjectId] */
  function openEntry(kind, subjectId = null) {
    if (disabled || busyRef.current) return;
    busyRef.current = true; setInitialSubject(subjectId); setEntry(kind); setActionError('');
  }
  return {
    user, data, clock, today, disabled, blocked, workingBlock, seeding, demoRevision, addingReview, workingReview, addReview, review,
    notice, dismissNotice: () => setNotice(''), error: data.error || actionError,
    refresh: refreshData, refreshInBackground,
    complete, loadDemoData, openEntry, openSchedule, openReschedule,
    signingOut, signOutError, signOut: () => { if (!busyRef.current) void signOut(); },
    entry, initialSubject, schedule, setEntry, setSchedule, setNotice, savedSession,
  };
}

/** @param {{children: import('react').ReactNode}} props */
export function StudyWorkspace({ children }) {
  const { user } = useSession();
  if (!user) return null;
  return <WorkspaceContent key={user.id} user={user}>{children}</WorkspaceContent>;
}

/** @param {{user: import('../auth/AuthService').AuthUser, children: import('react').ReactNode}} props */
function WorkspaceContent({ user, children }) {
  const study = useWorkspaceState(user);
  return (
    <StudyContext.Provider value={study}>
      {children}
      {study.entry && <EntrySheet key={study.entry} kind={study.entry} userId={study.user.id} subjects={study.data.subjects} initialSubject={study.initialSubject}
        onClose={() => study.setEntry(null)} onSaved={() => {
          study.setEntry(null);
          study.setNotice(study.entry === 'subject' ? 'Subject created.' : 'Task created.');
          void study.data.refresh();
        }} />}
      {study.schedule && <ScheduleSheet userId={study.user.id} {...study.schedule} onClose={() => study.setSchedule(null)} onSaved={study.savedSession} />}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const study = useContext(StudyContext);
  if (!study) throw new Error('useStudy must be used inside StudyWorkspace.');
  return study;
}
