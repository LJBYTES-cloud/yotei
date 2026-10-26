import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../auth/SessionContext';
import { getLocalDateKey } from '../db/dateUtils';
import { deleteTask } from '../db/TaskService';
import { deleteSubject } from '../db/SubjectService';
import { deleteMaterial } from '../db/MaterialService';
import { useTheme } from '../ThemeContext';
import { finishStudyBlock, pauseStudyBlock, resumeStudyBlock, startStudyBlock } from '../db/StudyBlockService';
import { seedDemoData } from '../db/seedData';
import { createReflectionItem } from '../db/ReflectionService';
import { exportBackup, importBackup } from '../db/BackupService';
import { useDashboardData } from '../hooks/useDashboardData';
import EntrySheet from './EntrySheet';
import ScheduleSheet from './ScheduleSheet';
import CompletionReflectionSheet from './CompletionReflectionSheet';
import MaterialSheet from './MaterialSheet';
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
  const [initialField, setInitialField] = useState('');
  const [editingSubject, setEditingSubject] = useState(/** @type {import('../db/SubjectService').Subject | null} */ (null));
  const [editingTask, setEditingTask] = useState(/** @type {import('../db/TaskService').Task | null} */ (null));
  const [deletingTask, setDeletingTask] = useState(/** @type {number | null} */ (null));
  const [deletingSubject, setDeletingSubject] = useState(/** @type {number | null} */ (null));
  const [deletingMaterial, setDeletingMaterial] = useState(/** @type {number | null} */ (null));
  const [materialEntry, setMaterialEntry] = useState(/** @type {{subjectId: number, material?: import('../db/MaterialService').Material} | null} */ (null));
  const [schedule, setSchedule] = useState(/** @type {Schedule | null} */ (null));
  const [reflectionPrompt, setReflectionPrompt] = useState(/** @type {StudyBlock | null} */ (null));
  const [workingBlock, setWorkingBlock] = useState(/** @type {number | null} */ (null));
  const [workingTimerAction, setWorkingTimerAction] = useState(/** @type {'start' | 'break' | 'resume' | 'finish' | null} */ (null));
  const [addingReflection, setAddingReflection] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [backupAction, setBackupAction] = useState(/** @type {'export' | 'import' | null} */ (null));
  // Full data replacements invalidate subject selections and unfinished topics.
  const [demoRevision, setDemoRevision] = useState(0);
  const [notice, setNoticeValue] = useState('');
  const [noticeId, setNoticeId] = useState(0);
  const setNotice = useCallback((/** @type {string} */ message) => {
    setNoticeValue(message); setNoticeId(id => id + 1);
  }, []);
  const dismissNotice = useCallback(() => setNoticeValue(''), []);
  const [actionError, setActionError] = useState('');
  const mutation = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const busy = signingOut || workingBlock !== null || deletingTask !== null || deletingSubject !== null || deletingMaterial !== null || seeding || backupAction !== null || addingReflection;
  const disabled = busy || !data.ready || data.refreshing;
  const blocked = busy || entry !== null || schedule !== null || reflectionPrompt !== null || materialEntry !== null;
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

  /** @param {{subject_id: number, note: string}} input @returns {Promise<boolean>} */
  async function addReflection(input) {
    if (mutation.current || disabled || busyRef.current) return false;
    mutation.current = true; busyRef.current = true; setAddingReflection(true); setActionError(''); setNotice('');
    try {
      await createReflectionItem(user.id, input);
      if (!mounted.current) return false;
      setNotice('Reflection saved.');
      await data.refresh();
      return true;
    } catch {
      if (mounted.current) setActionError('Could not save the reflection. Check the subject and try again.');
      return false;
    } finally { mutation.current = false; busyRef.current = false; if (mounted.current) setAddingReflection(false); }
  }

  /** @param {string} note @returns {Promise<boolean>} */
  async function addCompletedReflection(note) {
    if (!reflectionPrompt || mutation.current || busy) return false;
    mutation.current = true; busyRef.current = true; setAddingReflection(true); setActionError('');
    let saved = false;
    try {
      await createReflectionItem(user.id, { subject_id: reflectionPrompt.subject_id, study_block_id: reflectionPrompt.id, note });
      saved = true;
      if (!mounted.current) return true;
      setReflectionPrompt(null);
      setNotice('Reflection saved.');
      await data.refresh();
      return true;
    } catch { return false; }
    finally { mutation.current = false; busyRef.current = !saved; if (mounted.current) setAddingReflection(false); }
  }

  function dismissReflectionPrompt() {
    if (mutation.current || busy) return;
    busyRef.current = false;
    setReflectionPrompt(null);
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
      setReflectionPrompt(completed);
      setNotice(`Session completed. ${formatElapsed(completed.actual_study_seconds)} studied.`);
      await data.refresh();
    } catch { if (mounted.current) setActionError('We couldn’t update that session. Pull down to refresh, then try again.'); }
    finally { mutation.current = false; busyRef.current = openedPrompt; if (mounted.current) { setWorkingBlock(null); setWorkingTimerAction(null); } }
  }

  async function loadDemoData() {
    if (mutation.current || disabled || busyRef.current) return;
    mutation.current = true; busyRef.current = true; setSeeding(true); setActionError(''); setNotice('');
    try {
      await seedDemoData(user.id);
      if (!mounted.current) return;
      setClock(Date.now()); setToday(getLocalDateKey());
      await data.refresh();
      if (mounted.current) {
        setDemoRevision(value => value + 1);
        setNotice('Demo loaded: 3 subjects, 6 tasks, 3 reflections, 6 previous study days, and 4 hours planned today.');
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
        if (mounted.current) setNotice(`Backup imported: ${counts.subjects} subjects, ${counts.tasks} tasks, ${counts.studyBlocks} study blocks, ${counts.reflectionItems} reflections, and ${counts.materials} materials.`);
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
  /** @param {'subject' | 'task'} kind @param {number | null} [subjectId] @param {string} [fieldOfStudy] */
  function openEntry(kind, subjectId = null, fieldOfStudy = '') {
    if (disabled || busyRef.current) return;
    busyRef.current = true; setEditingSubject(null); setEditingTask(null); setInitialSubject(subjectId); setInitialField(kind === 'subject' ? fieldOfStudy : ''); setEntry(kind); setActionError(''); setNotice('');
  }
  /** @param {import('../db/SubjectService').Subject} subject */
  function openEditSubject(subject) {
    if (disabled || busyRef.current || subject.user_id !== user.id) return;
    busyRef.current = true; setEditingSubject(subject); setEditingTask(null); setInitialSubject(null); setInitialField(''); setEntry('subject'); setActionError(''); setNotice('');
  }
  /** @param {import('../db/TaskService').Task} task */
  function openEditTask(task) {
    if (disabled || busyRef.current || task.user_id !== user.id) return;
    busyRef.current = true; setEditingTask(task); setEditingSubject(null); setInitialSubject(null); setInitialField(''); setEntry('task'); setActionError('');
  }
  /** @param {number} subjectId @param {import('../db/MaterialService').Material} [material] */
  function openMaterial(subjectId, material) {
    if (disabled || busyRef.current || !data.subjects.some(subject => subject.id === subjectId)) return;
    busyRef.current = true; setMaterialEntry({ subjectId, material }); setActionError(''); setNotice('');
  }
  /** @param {import('../db/TaskService').Task | import('../db/SubjectService').Subject | import('../db/MaterialService').Material} record @param {'task' | 'subject' | 'material'} kind */
  function confirmDeleteRecord(record, kind) {
    const owned = 'user_id' in record ? record.user_id === user.id : data.materials.some(item => item.id === record.id);
    if (mutation.current || disabled || busyRef.current || !owned) return;
    const setDeleting = kind === 'task' ? setDeletingTask : kind === 'subject' ? setDeletingSubject : setDeletingMaterial;
    const label = kind === 'task' ? 'Task' : kind === 'subject' ? 'Subject' : 'Material';
    mutation.current = true; busyRef.current = true; setDeleting(record.id); setActionError(''); setNotice('');
    let started = false, settled = false;
    const release = () => {
      settled = true; mutation.current = false; busyRef.current = false;
      if (mounted.current) setDeleting(null);
    };
    const cancel = () => { if (!started && !settled) release(); };
    const remove = async () => {
      if (started || settled || !mounted.current) return;
      started = true;
      try {
        await ({ task: deleteTask, subject: deleteSubject, material: deleteMaterial }[kind](user.id, record.id));
        if (!mounted.current) return;
        setNotice(`${label} deleted.`);
        await data.refresh();
      } catch {
        if (mounted.current) setActionError(`Could not delete this ${kind}. Refresh and try again.`);
      } finally { release(); }
    };
    const message = kind === 'task'
      ? 'Are you sure you want to delete this task? All associated study blocks will also be permanently deleted. Subject reflections and materials will be kept.'
      : kind === 'subject' ? 'Are you sure you want to delete this subject? All associated tasks and reflections will also be permanently deleted.'
        : 'Delete this material link? The original file or website will not be deleted.';
    Alert.alert(`Delete ${label}`, message, [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Delete', style: 'destructive', onPress: () => { void remove(); } },
    ], { cancelable: true, onDismiss: cancel, userInterfaceStyle: isDark ? 'dark' : 'light' });
  }
  /** @param {import('../db/TaskService').Task} task */
  function confirmDeleteTask(task) { confirmDeleteRecord(task, 'task'); }
  /** @param {import('../db/SubjectService').Subject} subject */
  function confirmDeleteSubject(subject) { confirmDeleteRecord(subject, 'subject'); }
  /** @param {import('../db/MaterialService').Material} material */
  function confirmDeleteMaterial(material) { confirmDeleteRecord(material, 'material'); }
  function savedEntry() {
    setEntry(null);
    setNotice(entry === 'task' ? editingTask ? 'Task updated.' : 'Task created.' : '');
    void data.refresh();
  }
  return {
    user, data, clock, today, disabled, blocked, workingBlock, workingTimerAction, seeding, demoRevision, addingReflection, addReflection,
    notice, noticeId, dismissNotice, error: data.error || actionError,
    refresh: refreshData, refreshInBackground,
    complete, controlTimer, loadDemoData, backupAction, manageBackup, openEntry, openEditSubject, openEditTask, confirmDeleteTask, deletingTask, confirmDeleteSubject, deletingSubject, savedEntry, openSchedule, openReschedule,
    signingOut, signOutError, signOut: () => { if (!busyRef.current) void signOut(); },
    entry, initialSubject, initialField, editingSubject, editingTask, schedule, setEntry, setSchedule, setNotice, savedSession,
    reflectionPrompt, addCompletedReflection, dismissReflectionPrompt,
    openMaterial, materialEntry, setMaterialEntry, confirmDeleteMaterial, deletingMaterial,
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
      {study.entry && <EntrySheet key={study.editingSubject ? `edit-subject-${study.editingSubject.id}` : study.editingTask ? `edit-task-${study.editingTask.id}` : study.entry} kind={study.entry} userId={study.user.id} subjects={study.data.subjects} initialSubject={study.initialSubject} initialField={study.initialField} editingSubject={study.editingSubject} editingTask={study.editingTask}
        onClose={() => study.setEntry(null)} onSaved={study.savedEntry} onDeleted={() => {
          study.setEntry(null);
          study.setNotice('Subject deleted.');
          void study.data.refresh();
        }} />}
      {study.schedule && <ScheduleSheet userId={study.user.id} {...study.schedule} onClose={() => study.setSchedule(null)} onSaved={study.savedSession} />}
      {study.reflectionPrompt && <CompletionReflectionSheet key={study.reflectionPrompt.id} block={study.reflectionPrompt} busy={study.addingReflection || study.workingBlock !== null} onClose={study.dismissReflectionPrompt} onAdd={study.addCompletedReflection} />}
      {study.materialEntry && <MaterialSheet userId={user.id} {...study.materialEntry} onClose={() => study.setMaterialEntry(null)} onSaved={() => {
        study.setMaterialEntry(null); study.setNotice('Material saved.'); void study.data.refresh();
      }} />}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const study = useContext(StudyContext);
  if (!study) throw new Error('useStudy must be used inside StudyWorkspace.');
  return study;
}
