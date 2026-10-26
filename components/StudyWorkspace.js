import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { USE_REAL_AUTH } from '../auth';
import { useSession } from '../auth/SessionContext';
import { getLocalDateKey } from '../db/dateUtils';
import { deleteTask } from '../db/TaskService';
import { useTheme } from '../ThemeContext';
import { finishStudyBlock, pauseStudyBlock, resumeStudyBlock, startStudyBlock } from '../db/StudyBlockService';
import { seedDemoData } from '../db/seedData';
import { createReviewItem, markReviewed } from '../db/ReviewService';
import { exportBackup, importBackup } from '../db/BackupService';
import { useDashboardData } from '../hooks/useDashboardData';
import EntrySheet from './EntrySheet';
import ScheduleSheet from './ScheduleSheet';
import CompletionReviewSheet from './CompletionReviewSheet';
import { formatTime } from './theme';
import { formatElapsed } from '../utils/focusTimer';

/** @typedef {import('../db/StudyBlockService').StudyBlock} StudyBlock */
/** @typedef {{task: {id: number, title: string, subject_name: string}, sourceBlock?: StudyBlock, initialDuration?: number}} Schedule */
const StudyContext = createContext(/** @type {ReturnType<typeof useWorkspaceState> | null} */ (null));

/** @param {import('../auth/AuthService').AuthUser} user */
function useWorkspaceState(user) {
  const { signingOut, signOut, signOutError } = useSession();
  const { isDark } = useTheme();
  const [clock, setClock] = useState(() => Date.now());
  const [today, setToday] = useState(() => getLocalDateKey());
  const data = useDashboardData(user.id, today);
  const { blocks, refresh } = data;
  const [entry, setEntry] = useState(/** @type {'task' | 'subject' | null} */ (null));
  const [initialSubject, setInitialSubject] = useState(/** @type {number | null} */ (null));
  const [editingSubject, setEditingSubject] = useState(/** @type {import('../db/SubjectService').Subject | null} */ (null));
  const [editingTask, setEditingTask] = useState(/** @type {import('../db/TaskService').Task | null} */ (null));
  const [deletingTask, setDeletingTask] = useState(/** @type {number | null} */ (null));
  const [schedule, setSchedule] = useState(/** @type {Schedule | null} */ (null));
  const [reviewPrompt, setReviewPrompt] = useState(/** @type {StudyBlock | null} */ (null));
  const [workingBlock, setWorkingBlock] = useState(/** @type {number | null} */ (null));
  const [workingTimerAction, setWorkingTimerAction] = useState(/** @type {'start' | 'break' | 'resume' | 'finish' | null} */ (null));
  const [addingReview, setAddingReview] = useState(false);
  const [workingReview, setWorkingReview] = useState(/** @type {{id: number, difficulty: import('../db/ReviewService').ReviewDifficulty} | null} */ (null));
  const [seeding, setSeeding] = useState(false);
  const [backupAction, setBackupAction] = useState(/** @type {'export' | 'import' | null} */ (null));
  // Full data replacements invalidate subject selections and unfinished topics.
  const [demoRevision, setDemoRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const mutation = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const busy = signingOut || workingBlock !== null || deletingTask !== null || seeding || backupAction !== null || addingReview || workingReview !== null;
  const disabled = busy || !data.ready || data.refreshing;
  const blocked = busy || entry !== null || schedule !== null || reviewPrompt !== null;
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

  /** @param {string} topic @returns {Promise<boolean>} */
  async function addCompletedReview(topic) {
    if (!reviewPrompt || mutation.current || busy) return false;
    mutation.current = true; busyRef.current = true; setAddingReview(true); setActionError('');
    let saved = false;
    try {
      await createReviewItem(user.id, { subject_id: reviewPrompt.subject_id, topic });
      saved = true;
      if (!mounted.current) return true;
      setReviewPrompt(null);
      setNotice('Session completed. Topic added to the Review Queue.');
      await data.refresh();
      return true;
    } catch { return false; }
    finally { mutation.current = false; busyRef.current = !saved; if (mounted.current) setAddingReview(false); }
  }

  function dismissReviewPrompt() {
    if (mutation.current || busy) return;
    busyRef.current = false;
    setReviewPrompt(null);
  }

  /** @param {number} id @param {import('../db/ReviewService').ReviewDifficulty} difficulty */
  async function review(id, difficulty) {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setWorkingReview({ id, difficulty }); setActionError(''); setNotice('');
    try {
      await markReviewed(user.id, id, difficulty);
      if (!mounted.current) return;
      setNotice('Review saved.');
      await data.refresh();
    } catch {
      if (mounted.current) setActionError('Could not save the review. Refresh the queue and try again.');
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setWorkingReview(null); }
  }

  /** @param {number} id @param {'start' | 'break' | 'resume'} action */
  async function controlTimer(id, action) {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setWorkingBlock(id); setWorkingTimerAction(action); setActionError(''); setNotice('');
    try {
      const service = { start: startStudyBlock, break: pauseStudyBlock, resume: resumeStudyBlock }[action];
      await service(user.id, id);
      if (!mounted.current) return;
      setClock(Date.now());
      await data.refresh();
    } catch (error) {
      if (mounted.current) setActionError(error instanceof Error ? error.message : 'Could not update the timer. Refresh and try again.');
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) { setWorkingBlock(null); setWorkingTimerAction(null); } }
  }

  /** @param {number} id */
  async function complete(id) {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setWorkingBlock(id); setWorkingTimerAction('finish'); setActionError('');
    let openedPrompt = false;
    try {
      const completed = await finishStudyBlock(user.id, id);
      if (!mounted.current) return;
      openedPrompt = true;
      setReviewPrompt(completed);
      setNotice(`Session completed. ${formatElapsed(completed.actual_study_seconds)} studied.`);
      await data.refresh();
    } catch { if (mounted.current) setActionError('We couldn’t update that session. Pull down to refresh, then try again.'); }
    finally { mutation.current = false; busyRef.current = openedPrompt; if (mounted.current) { setWorkingBlock(null); setWorkingTimerAction(null); } }
  }

  async function loadDemoData() {
    if (USE_REAL_AUTH || mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setSeeding(true); setActionError(''); setNotice('');
    try {
      await seedDemoData(user.id);
      if (!mounted.current) return;
      setClock(Date.now()); setToday(getLocalDateKey());
      await data.refresh();
      if (mounted.current) {
        setDemoRevision(value => value + 1);
        setNotice('Demo loaded: 3 subjects, 6 tasks, 3 due reviews, and 4 hours of study sessions today.');
        router.navigate('/');
      }
    } catch {
      if (mounted.current) setActionError('Demo data couldn’t load. Your previous study data is unchanged; please try again.');
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setSeeding(false); }
  }

  /** @param {'export' | 'import'} action */
  async function manageBackup(action) {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setBackupAction(action); setActionError(''); setNotice('');
    try {
      if (action === 'export') {
        await exportBackup(user.id);
        if (mounted.current) setNotice('Backup prepared. Use the share sheet to save a copy.');
      } else {
        const counts = await importBackup(user.id);
        if (!counts || !mounted.current) return;
        setClock(Date.now()); setToday(getLocalDateKey());
        setDemoRevision(value => value + 1);
        await data.refresh();
        if (mounted.current) setNotice(`Backup imported: ${counts.subjects} subjects, ${counts.tasks} tasks, ${counts.studyBlocks} study blocks, ${counts.reviewItems} review topics, and ${counts.materials} materials.`);
      }
    } catch (error) {
      if (mounted.current) {
        const message = error instanceof Error ? error.message : 'Please try again.';
        setActionError(action === 'import'
          ? `Import failed. ${message} Your existing local data was not replaced.`
          : `Export failed. ${message}`);
      }
    } finally {
      mutation.current = false; busyRef.current = false;
      if (mounted.current) setBackupAction(null);
    }
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
    busyRef.current = true; setEditingSubject(null); setEditingTask(null); setInitialSubject(subjectId); setEntry(kind); setActionError('');
  }
  /** @param {import('../db/SubjectService').Subject} subject */
  function openEditSubject(subject) {
    if (disabled || busyRef.current || subject.user_id !== user.id) return;
    busyRef.current = true; setEditingSubject(subject); setEditingTask(null); setInitialSubject(null); setEntry('subject'); setActionError('');
  }
  /** @param {import('../db/TaskService').Task} task */
  function openEditTask(task) {
    if (disabled || busyRef.current || task.user_id !== user.id) return;
    busyRef.current = true; setEditingTask(task); setEditingSubject(null); setInitialSubject(null); setEntry('task'); setActionError('');
  }
  /** @param {import('../db/TaskService').Task} task */
  function confirmDeleteTask(task) {
    if (mutation.current || disabled || busyRef.current || task.user_id !== user.id) return;
    mutation.current = true; busyRef.current = true; setDeletingTask(task.id); setActionError(''); setNotice('');
    let started = false, settled = false;
    const release = () => {
      settled = true; mutation.current = false; busyRef.current = false;
      if (mounted.current) setDeletingTask(null);
    };
    const cancel = () => { if (!started && !settled) release(); };
    const remove = async () => {
      if (started || settled || !mounted.current) return;
      started = true;
      try {
        await deleteTask(user.id, task.id);
        if (!mounted.current) return;
        setNotice('Task deleted.');
        await data.refresh();
      } catch {
        if (mounted.current) setActionError('Could not delete this task. Refresh and try again.');
      } finally { release(); }
    };
    Alert.alert('Delete Task', 'Are you sure you want to delete this task? All associated study blocks will also be permanently deleted. Subject reviews and materials will be kept.', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Delete', style: 'destructive', onPress: () => { void remove(); } },
    ], { cancelable: true, onDismiss: cancel, userInterfaceStyle: isDark ? 'dark' : 'light' });
  }
  return {
    user, data, clock, today, disabled, blocked, workingBlock, workingTimerAction, seeding, demoRevision, addingReview, workingReview, addReview, review,
    notice, dismissNotice: () => setNotice(''), error: data.error || actionError,
    refresh: refreshData, refreshInBackground,
    complete, controlTimer, loadDemoData, backupAction, manageBackup, openEntry, openEditSubject, openEditTask, confirmDeleteTask, deletingTask, openSchedule, openReschedule,
    signingOut, signOutError, signOut: () => { if (!busyRef.current) void signOut(); },
    entry, initialSubject, editingSubject, editingTask, schedule, setEntry, setSchedule, setNotice, savedSession,
    reviewPrompt, addCompletedReview, dismissReviewPrompt,
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
      {study.entry && <EntrySheet key={study.editingSubject ? `edit-subject-${study.editingSubject.id}` : study.editingTask ? `edit-task-${study.editingTask.id}` : study.entry} kind={study.entry} userId={study.user.id} subjects={study.data.subjects} initialSubject={study.initialSubject} editingSubject={study.editingSubject} editingTask={study.editingTask}
        onClose={() => study.setEntry(null)} onSaved={() => {
          study.setEntry(null);
          study.setNotice(study.editingSubject ? 'Subject updated.' : study.editingTask ? 'Task updated.' : study.entry === 'subject' ? 'Subject created.' : 'Task created.');
          void study.data.refresh();
        }} onDeleted={() => {
          study.setEntry(null);
          study.setNotice('Subject deleted.');
          void study.data.refresh();
        }} />}
      {study.schedule && <ScheduleSheet userId={study.user.id} {...study.schedule} onClose={() => study.setSchedule(null)} onSaved={study.savedSession} />}
      {study.reviewPrompt && <CompletionReviewSheet key={study.reviewPrompt.id} block={study.reviewPrompt} busy={study.addingReview || study.workingBlock !== null} onClose={study.dismissReviewPrompt} onAdd={study.addCompletedReview} />}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const study = useContext(StudyContext);
  if (!study) throw new Error('useStudy must be used inside StudyWorkspace.');
  return study;
}
