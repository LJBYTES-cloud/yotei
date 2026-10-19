import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator, AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { authService, USE_REAL_AUTH } from './auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from './auth/MockAuthService';
import { createSubject, getSubjectsForUser } from './db/SubjectService';
import { createTask, getTasksForUser } from './db/TaskService';
import {
  createStudyBlock, getStudyBlocksForUser, markExpiredStudyBlocks,
  rescheduleStudyBlock, updateStudyBlockStatus,
} from './db/StudyBlockService';
import { getLocalDateKey, getLocalDayRange } from './db/dateUtils';

const colors = {
  background: '#0C1117', surface: '#151D27', input: '#0E151E',
  line: '#293442', text: '#F4F6F8', muted: '#A1ADBC', accent: '#B8A0F5',
};

/** @param {{ label: string, action?: import('react').ReactNode } & import('react-native').TextInputProps} props */
function Field({ label, action, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#738194"
          selectionColor={colors.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          {...props}
        />
        {action}
      </View>
    </View>
  );
}

/** @param {{ message: string }} props */
function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/**
 * @param {{ user: import('./auth/AuthService').AuthUser, onSignOut: () => Promise<void>,
 * signingOut: boolean, signOutError: string }} props
 */
function Dashboard({ user, onSignOut, signingOut, signOutError }) {
  const [subjects, setSubjects] = useState(/** @type {import('./db/SubjectService').Subject[]} */ ([]));
  const [tasks, setTasks] = useState(/** @type {import('./db/TaskService').Task[]} */ ([]));
  const [studyBlocks, setStudyBlocks] = useState(/** @type {import('./db/StudyBlockService').StudyBlock[]} */ ([]));
  const [today, setToday] = useState(() => getLocalDateKey());
  const [schedulingTaskId, setSchedulingTaskId] = useState(/** @type {number | null} */ (null));
  const [editorTaskId, setEditorTaskId] = useState(/** @type {number | null} */ (null));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [startDelay, setStartDelay] = useState(0);
  const [updatingBlockId, setUpdatingBlockId] = useState(/** @type {number | null} */ (null));
  const [clock, setClock] = useState(() => Date.now());
  const [scheduleNotice, setScheduleNotice] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(/** @type {number | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [subjectError, setSubjectError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [saving, setSaving] = useState(/** @type {'subject' | 'task' | null} */ (null));
  const savingRef = useRef(false);
  const mounted = useRef(false);
  const busy = signingOut || saving !== null || schedulingTaskId !== null || updatingBlockId !== null;
  const formsDisabled = busy || loading || Boolean(loadError);
  const todaysBlocks = useMemo(() => {
    const { start, end } = getLocalDayRange(today);
    return studyBlocks.filter(block => (Date.parse(block.start_time) < Date.parse(end)
      && Date.parse(block.end_time) > Date.parse(start)) || (block.status === 'missed' && !block.rescheduled_to));
  }, [studyBlocks, today]);

  useEffect(() => {
    /** @type {ReturnType<typeof setTimeout>} */
    let midnightTimer;
    function updateToday() {
      clearTimeout(midnightTimer);
      const date = getLocalDateKey();
      setToday(date);
      setClock(Date.now());
      midnightTimer = setTimeout(updateToday, Math.max(100, Date.parse(getLocalDayRange(date).end) - Date.now() + 100));
    }
    updateToday();
    const clockTimer = setInterval(() => setClock(Date.now()), 30_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') updateToday();
    });
    return () => { clearTimeout(midnightTimer); clearInterval(clockTimer); subscription.remove(); };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setLoadError('');
      try {
        await markExpiredStudyBlocks(user.id);
        const [nextSubjects, nextTasks, nextBlocks] = await Promise.all([
          getSubjectsForUser(user.id), getTasksForUser(user.id),
          getStudyBlocksForUser(user.id, { date: today, includeUnresolvedMissed: true }),
        ]);
        if (!active) return;
        setSubjects(nextSubjects);
        setTasks(nextTasks);
        setStudyBlocks(nextBlocks);
        setSelectedSubjectId(current => nextSubjects.some(subject => subject.id === current)
          ? current : nextSubjects[0]?.id ?? null);
      } catch {
        if (active) setLoadError('We couldn’t load your study space. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, [user.id, reloadAttempt, today]);

  useEffect(() => {
    if (loading || busy || loadError || !studyBlocks.some(block => block.status === 'scheduled' && Date.parse(block.end_time) < clock)) return;
    let active = true;
    async function refreshExpiredBlocks() {
      try {
        await markExpiredStudyBlocks(user.id);
        const nextBlocks = await getStudyBlocksForUser(user.id, { date: today, includeUnresolvedMissed: true });
        if (active) {
          setStudyBlocks(nextBlocks);
          setScheduleError('');
        }
      } catch {
        if (active) setScheduleError('We couldn’t refresh your sessions. Please try again.');
      }
    }
    void refreshExpiredBlocks();
    return () => { active = false; };
  }, [busy, clock, loading, loadError, studyBlocks, today, user.id]);

  async function addSubject() {
    if (savingRef.current || formsDisabled) return;
    setSubjectError('');
    if (!subjectName.trim()) {
      setSubjectError('Give your subject a name first.');
      return;
    }
    savingRef.current = true;
    setSaving('subject');
    Keyboard.dismiss();
    try {
      const subject = await createSubject(user.id, { name: subjectName, color: colors.accent });
      if (!mounted.current) return;
      setSubjects(current => [...current, subject]);
      setSelectedSubjectId(subject.id);
      setSubjectName('');
      setTaskError('');
    } catch {
      if (mounted.current) setSubjectError('We couldn’t save this subject. Your draft is still here; try again.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(null);
    }
  }

  async function addTask() {
    if (savingRef.current || formsDisabled) return;
    setTaskError('');
    if (!taskTitle.trim() || selectedSubjectId === null) {
      setTaskError(!taskTitle.trim() ? 'Give your task a title first.' : 'Add and choose a subject for this task.');
      return;
    }
    savingRef.current = true;
    setSaving('task');
    Keyboard.dismiss();
    try {
      const task = await createTask(user.id, { title: taskTitle, subject_id: selectedSubjectId });
      if (!mounted.current) return;
      setTasks(current => [task, ...current]);
      setTaskTitle('');
    } catch {
      if (mounted.current) setTaskError('We couldn’t save this task. Your draft is still here; try again.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(null);
    }
  }

  /** @param {number} taskId */
  function openSchedule(taskId) {
    if (savingRef.current || formsDisabled) return;
    setEditorTaskId(current => current === taskId ? null : taskId);
    setDurationMinutes(30);
    setStartDelay(0);
    setScheduleError('');
    setScheduleNotice('');
  }

  /** @param {number} taskId */
  async function scheduleTask(taskId) {
    if (savingRef.current || formsDisabled) return;
    savingRef.current = true;
    setSchedulingTaskId(taskId);
    setScheduleError('');
    setScheduleNotice('');
    const start = new Date();
    start.setTime(start.getTime() + startDelay * 60 * 1000);
    try {
      const block = await createStudyBlock(user.id, {
        task_id: taskId,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString(),
      });
      if (!mounted.current) return;
      setStudyBlocks(current => [...current, block].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time) || a.id - b.id));
      setEditorTaskId(null);
      setClock(new Date().getTime());
      setScheduleNotice(`Scheduled for ${formatSessionStart(block.start_time)}.`);
    } catch {
      if (mounted.current) setScheduleError('We couldn’t schedule this session. Please try again.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSchedulingTaskId(null);
    }
  }

  /** @param {number} blockId @param {boolean} [reschedule] */
  async function changeBlock(blockId, reschedule = false) {
    if (savingRef.current || formsDisabled) return;
    savingRef.current = true;
    setUpdatingBlockId(blockId);
    setScheduleError('');
    setScheduleNotice('');
    try {
      const result = reschedule
        ? await rescheduleStudyBlock(user.id, blockId)
        : await updateStudyBlockStatus(user.id, blockId, 'done');
      if (!mounted.current) return;
      setStudyBlocks(current => reschedule
        ? [...current.filter(block => block.id !== result.id).map(block => block.id === blockId ? { ...block, rescheduled_to: result.id } : block), result]
          .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time) || a.id - b.id)
        : current.map(block => block.id === blockId ? result : block));
      setClock(new Date().getTime());
      setScheduleNotice(reschedule ? `Rescheduled for ${formatSessionStart(result.start_time)}.` : 'Study block completed. A little progress, made.');
    } catch {
      if (mounted.current) setScheduleError('We couldn’t update this session. Please try again.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setUpdatingBlockId(null);
    }
  }

  /** @param {string} timestamp */
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /** @param {string} timestamp */
  function formatSessionStart(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          data={tasks}
          keyExtractor={task => String(task.id)}
          contentContainerStyle={dashboardStyles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          ListHeaderComponent={
            <>
              <View style={dashboardStyles.topRow}>
                <Text style={styles.brandName}>yotei<Text style={styles.brandDot}>.</Text></Text>
                <Pressable
                  accessibilityRole="button" accessibilityLabel="Sign out"
                  accessibilityState={{ disabled: busy, busy: signingOut }} disabled={busy}
                  onPress={() => { if (!savingRef.current) void onSignOut(); }}
                  style={({ pressed }) => [dashboardStyles.signOut, pressed && styles.pressed, busy && styles.disabled]}
                >
                  {signingOut ? <ActivityIndicator color={colors.accent} /> : <Text style={dashboardStyles.signOutText}>Sign out ↗</Text>}
                </Pressable>
              </View>
              <View style={dashboardStyles.intro}>
                <Text style={styles.eyebrow}>YOUR STUDY SPACE</Text>
                <Text style={dashboardStyles.heading}>A little progress,{'\n'}{user.name.split(' ')[0] || 'friend'}<Text style={styles.accentText}>.</Text></Text>
                <Text style={styles.subtitle}>Give your plans a place. Take it one task at a time.</Text>
              </View>
              <ErrorMessage message={signOutError} />
              {loading && (
                <View style={dashboardStyles.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.accent} /><Text style={styles.subtitle}>Opening your study space…</Text>
                </View>
              )}
              {Boolean(loadError) && (
                <View style={dashboardStyles.retry}>
                  <ErrorMessage message={loadError} />
                  <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setReloadAttempt(value => value + 1)}>
                    <Text style={styles.secondaryText}>Try again</Text>
                  </Pressable>
                </View>
              )}

              <View style={[styles.card, dashboardStyles.formCard]}>
                <Text style={dashboardStyles.cardEyebrow}>01 / ORGANIZE</Text>
                <Text style={styles.cardTitle}>Add a subject</Text>
                <Text style={styles.cardDescription}>A home for each thing you’re learning.</Text>
                <Field label="Subject name" placeholder="e.g. Mathematics" value={subjectName} onChangeText={setSubjectName} maxLength={128} editable={!formsDisabled} returnKeyType="done" onSubmitEditing={() => void addSubject()} />
                <ErrorMessage message={subjectError} />
                <Pressable
                  accessibilityRole="button" accessibilityState={{ disabled: formsDisabled, busy: saving === 'subject' }}
                  disabled={formsDisabled} onPress={() => void addSubject()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, formsDisabled && styles.disabled]}
                >
                  {saving === 'subject' ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>＋ Add subject</Text>}
                </Pressable>
              </View>

              <View style={[styles.card, dashboardStyles.formCard]}>
                <Text style={dashboardStyles.cardEyebrow}>02 / MAKE A PLAN</Text>
                <Text style={styles.cardTitle}>Add a task</Text>
                <Text style={styles.cardDescription}>Turn something big into a next step.</Text>
                <Field label="Task title" placeholder="e.g. Practice chapter 3" value={taskTitle} onChangeText={setTaskTitle} maxLength={256} editable={!formsDisabled} returnKeyType="done" onSubmitEditing={() => void addTask()} />
                <Text style={styles.label}>Subject</Text>
                {subjects.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dashboardStyles.subjectChoices} keyboardShouldPersistTaps="handled" accessibilityRole="radiogroup" accessibilityLabel="Task subject">
                    {subjects.map(subject => (
                      <Pressable
                        key={subject.id} accessibilityRole="radio" accessibilityLabel={subject.name}
                        accessibilityState={{ checked: selectedSubjectId === subject.id, disabled: formsDisabled }}
                        disabled={formsDisabled} onPress={() => setSelectedSubjectId(subject.id)}
                        style={[dashboardStyles.subjectChoice, selectedSubjectId === subject.id && dashboardStyles.selectedChoice]}
                      >
                        <View style={[dashboardStyles.colorDot, { backgroundColor: subject.color }]} />
                        <Text style={[dashboardStyles.choiceText, selectedSubjectId === subject.id && dashboardStyles.selectedChoiceText]}>{subject.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : <Text style={dashboardStyles.hint}>{loading ? 'Loading your subjects…' : 'Add your first subject above to start planning.'}</Text>}
                <ErrorMessage message={taskError} />
                <Pressable
                  accessibilityRole="button" accessibilityState={{ disabled: formsDisabled || !subjects.length, busy: saving === 'task' }}
                  disabled={formsDisabled || !subjects.length} onPress={() => void addTask()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (formsDisabled || !subjects.length) && styles.disabled]}
                >
                  {saving === 'task' ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>＋ Add task</Text>}
                </Pressable>
              </View>

              <View style={dashboardStyles.sectionHeading}>
                <Text style={dashboardStyles.sectionTitle}>Your subjects</Text><Text style={dashboardStyles.count}>{subjects.length}</Text>
              </View>
              {subjects.map(subject => (
                <View key={subject.id} style={dashboardStyles.subjectRow}>
                  <View style={[dashboardStyles.colorDot, { backgroundColor: subject.color }]} />
                  <Text style={dashboardStyles.subjectName}>{subject.name}</Text>
                </View>
              ))}
              {!subjects.length && !loading && !loadError && <Text style={dashboardStyles.empty}>A blank page, full of possibilities. Add your first subject above.</Text>}
              <View style={dashboardStyles.sectionHeading}>
                <Text style={dashboardStyles.sectionTitle}>Your tasks</Text><Text style={dashboardStyles.count}>{tasks.length}</Text>
              </View>
            </>
          }
          extraData={schedulingTaskId}
          renderItem={({ item }) => (
            <View style={dashboardStyles.taskRow}>
              <View style={dashboardStyles.taskMarker} />
              <View style={dashboardStyles.taskDetails}>
                <Text style={dashboardStyles.taskTitle}>{item.title}</Text>
                <View style={dashboardStyles.taskMeta}>
                  <View style={[dashboardStyles.colorDot, { backgroundColor: item.subject_color }]} />
                  <Text style={dashboardStyles.taskSubject}>{item.subject_name}</Text>
                </View>
                <Pressable
                  accessibilityRole="button" accessibilityLabel={`Schedule ${item.title}`}
                  accessibilityState={{ disabled: formsDisabled, busy: schedulingTaskId === item.id }}
                  disabled={formsDisabled} onPress={() => openSchedule(item.id)}
                  style={({ pressed }) => [dashboardStyles.scheduleButton, pressed && styles.pressed, formsDisabled && styles.disabled]}
                >
                  <Text style={dashboardStyles.scheduleText}>Schedule</Text>
                </Pressable>
                {editorTaskId === item.id && (
                  <View style={dashboardStyles.scheduleEditor}>
                    <Text style={styles.label}>Duration</Text>
                    <View style={dashboardStyles.optionRow} accessibilityRole="radiogroup" accessibilityLabel="Study duration">
                      {[15, 30, 45, 60].map(minutes => (
                        <Pressable key={minutes} accessibilityRole="radio" accessibilityLabel={`${minutes} minutes`}
                          accessibilityState={{ checked: durationMinutes === minutes, disabled: busy }} disabled={busy}
                          onPress={() => setDurationMinutes(minutes)}
                          style={[dashboardStyles.subjectChoice, durationMinutes === minutes && dashboardStyles.selectedChoice]}>
                          <Text style={[dashboardStyles.choiceText, durationMinutes === minutes && dashboardStyles.selectedChoiceText]}>{minutes}m</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>Start time</Text>
                    <View style={dashboardStyles.optionRow} accessibilityRole="radiogroup" accessibilityLabel="Study start time">
                      {[0, 60].map(delay => (
                        <Pressable key={delay} accessibilityRole="radio" accessibilityLabel={delay === 0 ? 'Now' : 'In 1 hour'}
                          accessibilityState={{ checked: startDelay === delay, disabled: busy }} disabled={busy}
                          onPress={() => setStartDelay(delay)}
                          style={[dashboardStyles.subjectChoice, startDelay === delay && dashboardStyles.selectedChoice]}>
                          <Text style={[dashboardStyles.choiceText, startDelay === delay && dashboardStyles.selectedChoiceText]}>{delay === 0 ? 'Now' : 'In 1 hour'}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <ErrorMessage message={scheduleError} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Confirm schedule" disabled={formsDisabled}
                      accessibilityState={{ disabled: formsDisabled, busy: schedulingTaskId === item.id }}
                      onPress={() => void scheduleTask(item.id)}
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, formsDisabled && styles.disabled]}>
                      {schedulingTaskId === item.id ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>Confirm schedule</Text>}
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditorTaskId(null)} style={dashboardStyles.scheduleButton}>
                      <Text style={dashboardStyles.scheduleText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <Text style={dashboardStyles.status}>{item.status === 'pending' ? 'To do' : item.status.replace(/_/g, ' ')}</Text>
            </View>
          )}
          ListEmptyComponent={!loading && !loadError ? <Text style={dashboardStyles.empty}>Room for your next step. Add a task when you’re ready.</Text> : null}
          ListFooterComponent={
            <>
              <View style={dashboardStyles.sectionHeading}>
                <Text style={dashboardStyles.sectionTitle}>Today&apos;s Focus</Text><Text style={dashboardStyles.count}>{todaysBlocks.length}</Text>
              </View>
              <ErrorMessage message={scheduleError} />
              {Boolean(scheduleNotice) && <Text style={dashboardStyles.hint} accessibilityLiveRegion="polite">{scheduleNotice}</Text>}
              <View accessibilityLiveRegion="polite">
                {todaysBlocks.map(block => (
                  <View key={block.id} style={dashboardStyles.taskRow}>
                    <View style={[dashboardStyles.colorDot, dashboardStyles.focusDot, { backgroundColor: block.subject_color }]} />
                    <View style={dashboardStyles.taskDetails}>
                      <Text style={dashboardStyles.taskTitle}>{block.task_title}</Text>
                      <View style={dashboardStyles.taskMeta}>
                        <Text style={dashboardStyles.taskSubject}>{getLocalDateKey(new Date(block.start_time)) === today ? formatTime(block.start_time) : formatSessionStart(block.start_time)} – {formatTime(block.end_time)}</Text>
                      </View>
                      <Text style={[dashboardStyles.scheduleText, dashboardStyles.blockStatus]}>{block.rescheduled_to ? 'Missed · Rescheduled' : block.status === 'done' ? 'Done' : block.status === 'missed' ? 'Missed' : Date.parse(block.start_time) <= clock ? 'In progress' : 'Scheduled'}</Text>
                      {block.status === 'scheduled' && Date.parse(block.start_time) <= clock && Date.parse(block.end_time) >= clock && (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${block.task_title} done`}
                          accessibilityState={{ disabled: formsDisabled, busy: updatingBlockId === block.id }} disabled={formsDisabled}
                          onPress={() => void changeBlock(block.id)}
                          style={({ pressed }) => [dashboardStyles.scheduleButton, pressed && styles.pressed, formsDisabled && styles.disabled]}>
                          {updatingBlockId === block.id ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={dashboardStyles.scheduleText}>Mark Done</Text>}
                        </Pressable>
                      )}
                      {block.status === 'missed' && !block.rescheduled_to && (
                        <>
                          <Text style={[dashboardStyles.taskSubject, dashboardStyles.missedPrompt]}>You missed this block. Reschedule?</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Reschedule ${block.task_title} in 1 hour`}
                            accessibilityState={{ disabled: formsDisabled, busy: updatingBlockId === block.id }} disabled={formsDisabled}
                            onPress={() => void changeBlock(block.id, true)}
                            style={({ pressed }) => [dashboardStyles.scheduleButton, pressed && styles.pressed, formsDisabled && styles.disabled]}>
                            {updatingBlockId === block.id ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={dashboardStyles.scheduleText}>Reschedule in 1 hour</Text>}
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              {!todaysBlocks.length && !loading && !loadError && <Text style={dashboardStyles.empty}>A little room to focus. Schedule a task above to begin.</Text>}
              <View style={styles.footer}><View style={styles.footerDot} /><Text style={styles.footerText}>A little more intention. Every day.</Text></View>
            </>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [user, setUser] = useState(/** @type {import('./auth/AuthService').AuthUser | null} */ (null));
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      setRestoring(true);
      setRestoreError('');
      try {
        const currentUser = await authService.getCurrentUser();
        if (active) setUser(currentUser);
      } catch {
        if (active) setRestoreError('We couldn’t restore your session. Please try again.');
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, [restoreAttempt]);

  /** @param {boolean} signUp */
  function changeMode(signUp) {
    if (submitting.current) return;
    setIsSignUp(signUp);
    setError('');
    setPassword('');
    setShowPassword(false);
  }

  async function authenticate(demo = false) {
    if (submitting.current) return;
    const credentials = {
      email: demo ? DEMO_EMAIL : email.trim().toLowerCase(),
      password: demo ? DEMO_PASSWORD : password,
      rememberMe,
    };
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      setError('Enter a valid email address to continue.');
      return;
    }
    if (!credentials.password) {
      setError('Enter your password to continue.');
      return;
    }
    if (isSignUp && !demo) {
      if (!name.trim()) {
        setError('Tell us your name to create your account.');
        return;
      }
      if (credentials.password.length < 8) {
        setError('Choose a password with at least 8 characters.');
        return;
      }
    }
    submitting.current = true;
    setWorking(true);
    Keyboard.dismiss();
    try {
      const nextUser = isSignUp && !demo
        ? await authService.signUp({ ...credentials, name: name.trim() })
        : await authService.signIn(credentials);
      setUser(nextUser);
      setPassword('');
      setShowPassword(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  async function signOut() {
    if (submitting.current) return;
    submitting.current = true;
    setWorking(true);
    setError('');
    try {
      await authService.signOut();
      setUser(null);
      setPassword('');
      setIsSignUp(false);
      setRememberMe(false);
    } catch {
      setError('We couldn’t sign you out. Please try again.');
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  if (user && !restoring && !restoreError) {
    return <Dashboard key={user.id} user={user} onSignOut={signOut} signingOut={working} signOutError={error} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.content}>
            <View style={styles.brand}>
              <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.logoLeft} /><View style={styles.logoRight} />
              </View>
              <Text style={styles.brandName}>yotei<Text style={styles.brandDot}>.</Text></Text>
            </View>

            {restoring || restoreError ? (
              <View style={styles.card}>
                {restoring ? (
                  <View style={styles.loading} accessibilityLiveRegion="polite">
                    <ActivityIndicator color={colors.accent} size="large" />
                    <Text style={styles.subtitle}>Getting your space ready…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Let’s try that again</Text>
                    <ErrorMessage message={restoreError} />
                    <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setRestoreAttempt(value => value + 1)}>
                      <Text style={styles.primaryText}>Retry</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <>
                <View style={styles.intro}>
                  <Text style={styles.eyebrow}>MAKE ROOM FOR WHAT MATTERS</Text>
                  <Text style={styles.heading}>{isSignUp ? 'Big plans.\nSmall steps' : 'Find your focus.\nOwn your day'}<Text style={styles.accentText}>.</Text></Text>
                  <Text style={styles.subtitle}>{isSignUp ? 'Start a fresh chapter. Build a rhythm that works for you.' : 'A calmer place to plan, study, and move forward.'}</Text>
                </View>
                <View style={styles.card}>
                  <View style={styles.tabs} accessibilityRole="tablist">
                    {[false, true].map(signUp => (
                      <Pressable
                        key={String(signUp)} accessibilityRole="tab"
                        accessibilityState={{ selected: isSignUp === signUp, disabled: working }}
                        disabled={working} onPress={() => changeMode(signUp)}
                        style={[styles.tab, isSignUp === signUp && styles.activeTab]}
                      >
                        <Text style={[styles.tabText, isSignUp === signUp && styles.activeTabText]}>{signUp ? 'Create account' : 'Sign in'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.cardTitle}>{isSignUp ? 'Your journey starts here' : 'Welcome back'}</Text>
                  <Text style={styles.cardDescription}>{isSignUp ? 'A fresh start is just a few details away.' : 'Good to see you. Let’s get you settled in.'}</Text>
                  {isSignUp && <Field label="Your name" placeholder="Alex Morgan" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={128} editable={!working} />}
                  <Field
                    label="Email address" placeholder="you@example.com"
                    value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
                    keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
                    maxLength={320} editable={!working}
                  />
                  <Field
                    label="Password" placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'}
                    value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
                    autoCapitalize="none" autoCorrect={false}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    textContentType={isSignUp ? 'newPassword' : 'password'} maxLength={256}
                    returnKeyType="go" onSubmitEditing={() => void authenticate()} editable={!working}
                    action={
                      <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} disabled={working} onPress={() => setShowPassword(value => !value)} style={styles.showPassword}>
                        <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </Pressable>
                    }
                  />
                  <ErrorMessage message={error} />
                  <Pressable
                    accessibilityRole="checkbox" accessibilityLabel="Remember me"
                    accessibilityState={{ checked: rememberMe, disabled: working }}
                    disabled={working} onPress={() => setRememberMe(value => !value)}
                    style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed, working && styles.disabled]}
                  >
                    <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
                      {rememberMe && <Text style={styles.rememberCheck}>✓</Text>}
                    </View>
                    <Text style={styles.rememberLabel}>Remember me</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button" accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
                    accessibilityState={{ disabled: working, busy: working }} disabled={working}
                    onPress={() => void authenticate()}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, working && styles.disabled]}
                  >
                    {working ? <ActivityIndicator color={colors.background} /> : (
                      <><Text style={styles.primaryText}>{isSignUp ? 'Create account' : 'Let’s get started'}</Text><Text style={styles.buttonArrow}>↗</Text></>
                    )}
                  </Pressable>
                  {!USE_REAL_AUTH && (
                    <>
                      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>a little look around?</Text><View style={styles.dividerLine} /></View>
                      <Pressable accessibilityRole="button" disabled={working} accessibilityState={{ disabled: working }} onPress={() => void authenticate(true)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, working && styles.disabled]}>
                        <Text style={styles.secondaryText}>Explore the demo</Text>
                      </Pressable>
                      <Text style={styles.demoNote}>Demo accounts are for exploring. New accounts reset when the app restarts.</Text>
                    </>
                  )}
                </View>
              </>
            )}
            <View style={styles.footer}><View style={styles.footerDot} /><Text style={styles.footerText}>A little more intention. Every day.</Text></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      <AuthScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accent, overflow: 'hidden' },
  logoLeft: { position: 'absolute', width: 5, height: 22, borderRadius: 3, backgroundColor: colors.background, left: 12, top: 7, transform: [{ rotate: '28deg' }] },
  logoRight: { position: 'absolute', width: 5, height: 14, borderRadius: 3, backgroundColor: colors.background, left: 21, top: 14, transform: [{ rotate: '-28deg' }] },
  brandName: { fontSize: 31, fontWeight: '700', letterSpacing: -1.5, color: colors.text },
  brandDot: { color: colors.accent },
  intro: { marginBottom: 28 },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 2, color: colors.accent, marginBottom: 14 },
  heading: { fontSize: 38, lineHeight: 45, fontWeight: '700', letterSpacing: -1.6, color: colors.text, marginBottom: 14 },
  accentText: { color: colors.accent },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 22, marginTop: 6 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, backgroundColor: colors.input, marginBottom: 26 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 44 },
  activeTab: { backgroundColor: '#2A3543' },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: colors.text },
  cardTitle: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '600', letterSpacing: -0.5 },
  cardDescription: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 5, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { color: '#D5DCE5', fontSize: 12, fontWeight: '600', marginBottom: 9 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input },
  inputFocused: { borderColor: colors.accent },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.text },
  showPassword: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center' },
  showPasswordText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  primaryButton: { flexDirection: 'row', minHeight: 54, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14, marginTop: 6, gap: 14 },
  primaryText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  buttonArrow: { color: colors.background, fontSize: 22, lineHeight: 24 },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderColor: '#3B4A5C', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 11 },
  demoNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  errorBox: { backgroundColor: '#352126', borderColor: '#6A3943', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16, marginTop: 6 },
  errorText: { color: '#FFC2C9', fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
  footerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  footerText: { color: colors.muted, fontSize: 11, letterSpacing: 0.2 },
  loading: { alignItems: 'center', gap: 20, paddingVertical: 40 },
  successIcon: { backgroundColor: '#27392C', width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  check: { color: colors.accent, fontSize: 25 },
  accountEmail: { color: colors.accent, fontSize: 15, marginTop: -12, marginBottom: 28 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 8, alignSelf: 'flex-start' },
  rememberCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  rememberCheckboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  rememberCheck: { color: colors.background, fontSize: 13, fontWeight: '700' },
  rememberLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
});

const dashboardStyles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 36 },
  signOut: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  signOutText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  intro: { marginBottom: 24 },
  heading: { fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -1.4, color: colors.text, marginBottom: 14 },
  formCard: { marginTop: 0, marginBottom: 16 },
  cardEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.6, marginBottom: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, marginBottom: 12 },
  retry: { marginBottom: 20 },
  subjectChoices: { gap: 8, paddingBottom: 18, paddingTop: 2 },
  subjectChoice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.input },
  selectedChoice: { borderColor: colors.accent, backgroundColor: '#2C2440' },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  selectedChoiceText: { color: colors.accent },
  colorDot: { width: 7, height: 7, borderRadius: 4 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 20, marginBottom: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 20, paddingBottom: 16 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 },
  count: { color: colors.accent, fontSize: 12, fontWeight: '600', backgroundColor: '#2C2440', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  subjectName: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 22, paddingVertical: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 16 },
  taskMarker: { width: 17, height: 17, borderRadius: 6, borderWidth: 1, borderColor: '#82729E', marginTop: 3 },
  taskDetails: { flex: 1, minWidth: 0 },
  taskTitle: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  taskSubject: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  status: { color: colors.accent, fontSize: 10, fontWeight: '600', paddingTop: 4, maxWidth: 60 },
  scheduleButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  scheduleText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  focusDot: { marginTop: 7 },
  scheduleEditor: { marginTop: 18 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  blockStatus: { marginTop: 10 },
  missedPrompt: { marginTop: 10 },
});
