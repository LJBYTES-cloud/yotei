import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocalDateKey, getLocalDayRange } from '../db/dateUtils';
import { updateStudyBlockStatus } from '../db/StudyBlockService';
import { useDashboardData } from '../hooks/useDashboardData';
import EntrySheet from './EntrySheet';
import ScheduleSheet from './ScheduleSheet';
import { Button, Message, Pill } from './ui';
import { formatMinutes, formatTime, palette as p } from './theme';

/** @typedef {import('../db/TaskService').Task} Task */
/** @typedef {import('../db/StudyBlockService').StudyBlock} StudyBlock */
/** @typedef {{kind: 'task', task: Task} | {kind: 'block', block: StudyBlock}} DashboardRow */

/** @param {{ task: Task, onSchedule: (minutes?: number) => void, disabled: boolean }} props */
function TaskCard({ task, onSchedule, disabled }) {
  return (
    <View style={s.taskCard}>
      <View style={s.cardTop}><View style={[s.subjectDot, { backgroundColor: task.subject_color }]} /><Text style={s.cardSubject}>{task.subject_name}</Text><Text style={s.taskNumber}>/{String(task.id).padStart(2, '0')}</Text></View>
      <Text style={s.taskTitle}>{task.title}</Text>
      {task.postpone_count >= 2 && (
        <View style={s.coaching}>
          <Text style={s.coachKicker}>SMALLER IS A STRATEGY</Text>
          <Text style={s.coachText}>Struggling to start? Try a 5-minute micro-action.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Schedule a 5-minute start for ${task.title}`} disabled={disabled} onPress={() => onSchedule(5)} style={s.microButton}><Text style={s.microText}>Just five minutes ↗</Text></Pressable>
        </View>
      )}
      <View style={s.cardBottom}>
        <Text style={s.taskHint}>{task.postpone_count ? `${task.postpone_count} fresh start${task.postpone_count === 1 ? '' : 's'}` : 'One thing at a time.'}</Text>
        <Button label="Schedule ↗" compact tone="quiet" disabled={disabled} onPress={() => onSchedule()} />
      </View>
    </View>
  );
}

/** @param {{ block: StudyBlock, clock: number, today: string, busy: boolean, working: boolean, onDone: () => void, onReschedule: () => void }} props */
function FocusCard({ block, clock, today, busy, working, onDone, onReschedule }) {
  const active = block.status === 'scheduled' && Date.parse(block.start_time) <= clock && Date.parse(block.end_time) >= clock;
  const missed = block.status === 'missed' && !block.rescheduled_to;
  const status = block.rescheduled_to ? 'Replanned' : block.status === 'done' ? 'Done' : missed ? 'Missed' : active ? 'In progress' : 'Scheduled';
  const oldDay = getLocalDateKey(new Date(block.start_time)) !== today;
  return (
    <View style={s.focusCard}>
      <View style={s.focusTop}><Text style={s.focusTime}>{formatTime(block.start_time)}</Text><Text style={[s.badge, active && s.activeBadge, missed && s.missedBadge, block.status === 'done' && s.doneBadge]}>{status}</Text></View>
      {oldDay && <Text style={s.oldDate}>{new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>}
      <View style={s.focusBody}><View style={[s.timelineLine, { backgroundColor: block.subject_color }]} /><View style={s.flex}><Text style={s.cardSubject}>{block.subject_name}</Text><Text style={s.focusTitle}>{block.task_title}</Text><Text style={s.taskHint}>{formatMinutes((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000)} · until {formatTime(block.end_time)}</Text></View></View>
      {active && <Button label="Mark Done ✓" tone="quiet" busy={working} disabled={busy} onPress={onDone} />}
      {missed && <View style={s.recovery}><Text style={s.coachText}>You missed this block. Reschedule?</Text><Text style={s.recoveryNote}>The plan can change. Your next step can be smaller.</Text><Button label="Plan a fresh start ↗" tone="quiet" disabled={busy} onPress={onReschedule} /></View>}
    </View>
  );
}

/** @param {{ user: import('../auth/AuthService').AuthUser, onSignOut: () => Promise<void>, signingOut: boolean, signOutError: string }} props */
export default function Dashboard({ user, onSignOut, signingOut, signOutError }) {
  const [clock, setClock] = useState(() => Date.now());
  const [today, setToday] = useState(() => getLocalDateKey());
  const data = useDashboardData(user.id, today);
  const { blocks, refresh } = data;
  const [tab, setTab] = useState(/** @type {'tasks' | 'focus'} */ ('tasks'));
  const [subjectId, setSubjectId] = useState(/** @type {number | null} */ (null));
  const [entry, setEntry] = useState(/** @type {'task' | 'subject' | null} */ (null));
  const [schedule, setSchedule] = useState(/** @type {{task: {id: number, title: string, subject_name: string}, sourceBlock?: StudyBlock, initialDuration?: number} | null} */ (null));
  const [workingBlock, setWorkingBlock] = useState(/** @type {number | null} */ (null));
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const mutation = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const busy = signingOut || workingBlock !== null;
  const disabled = busy || !data.ready || data.refreshing;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { busyRef.current = busy || entry !== null || schedule !== null; }, [busy, entry, schedule]);

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

  const filteredTasks = useMemo(() => data.tasks.filter(task => subjectId === null || task.subject_id === subjectId), [data.tasks, subjectId]);
  const focusBlocks = useMemo(() => data.blocks.filter(block => !block.rescheduled_to), [data.blocks]);
  const rows = useMemo(() => /** @type {DashboardRow[]} */ (tab === 'tasks'
    ? filteredTasks.map(task => ({ kind: 'task', task }))
    : focusBlocks.map(block => ({ kind: 'block', block }))), [tab, filteredTasks, focusBlocks]);
  const dayRange = getLocalDayRange(today);
  const completed = data.blocks.filter(block => block.status === 'done' && Date.parse(block.start_time) < Date.parse(dayRange.end) && Date.parse(block.end_time) > Date.parse(dayRange.start)).length;
  const plannedCount = focusBlocks.filter(block => block.status === 'scheduled').length;

  /** @param {number} id */
  async function complete(id) {
    if (mutation.current || disabled) return;
    mutation.current = true; setWorkingBlock(id); setActionError('');
    try {
      await updateStudyBlockStatus(user.id, id, 'done');
      if (!mounted.current) return;
      setNotice('A little progress, made. Take a breath.');
      await data.refresh();
    } catch { if (mounted.current) setActionError('We couldn’t update that session. Pull down to refresh, then try again.'); }
    finally { mutation.current = false; if (mounted.current) setWorkingBlock(null); }
  }

  /** @param {StudyBlock} block */
  function savedSession(block) {
    setSchedule(null); setTab('focus'); setActionError('');
    const dateLabel = getLocalDateKey(new Date(block.start_time)) === today ? '' : `${new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, `;
    setNotice(`A little time, set aside. ${dateLabel}${formatTime(block.start_time)}–${formatTime(block.end_time)}.`);
    void data.refresh();
  }

  const header = (
    <>
      <View style={s.topbar}><Text style={s.wordmark}>yotei<Text style={s.accent}>.</Text></Text><Pressable accessibilityRole="button" disabled={busy || entry !== null || schedule !== null} onPress={() => void onSignOut()} style={s.account}><Text style={s.accountText}>{signingOut ? 'Signing out…' : 'Sign out ↗'}</Text></Pressable></View>
      <Text style={s.date}>{new Date(clock).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
      <Text style={s.greeting}>Easy does it,{ '\n' }<Text style={s.name}>{user.name.split(' ')[0] || 'friend'}.</Text></Text>
      <Text style={s.intro}>A little intention. A little room to breathe.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="View today's focus sessions" onPress={() => setTab('focus')} style={({ pressed }) => [s.dayCard, pressed && s.pressed]}>
        <View style={s.orbit} pointerEvents="none" /><Text style={s.dayKicker}>THE SHAPE OF YOUR DAY</Text>
        <View style={s.dayNumbers}><Text style={s.dayMinutes}>{formatMinutes(data.minutes)}</Text><Text style={s.dayCaption}>planned{ '\n' }& completed</Text></View>
        <View style={s.meter}><View style={[s.meterFill, { width: `${Math.min(data.minutes / 240 * 100, 100)}%`, backgroundColor: data.minutes > 240 ? p.warm : p.accent }]} /></View>
        <View style={s.dayBottom}><Text style={s.dayNote}>{data.minutes > 240 ? 'A full day. Leave space for breaks.' : '4 hours is a check-in, not a target.'}</Text><Text style={s.dayArrow}>↗</Text></View>
      </Pressable>
      <View style={s.smallStats}><Text style={s.statsText}><Text style={s.statNumber}>{plannedCount}</Text> focus sessions ahead</Text><View style={s.statDot} /><Text style={s.statsText}><Text style={s.statNumber}>{completed}</Text> done today</Text></View>
      <Message text={signOutError || data.error || actionError} />
      {data.error && <Button label="Try refreshing" compact tone="outline" onPress={() => void data.refresh()} />}
      {Boolean(notice) && <View style={s.notice}><View style={s.flex}><Message text={notice} kind="notice" /></View><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice('')} style={s.dismiss}><Text style={s.accountText}>×</Text></Pressable></View>}
      <View style={s.tabs} accessibilityRole="tablist">{[/** @type {'tasks'} */ ('tasks'), /** @type {'focus'} */ ('focus')].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabSelected]}><Text style={[s.tabText, tab === value && s.tabTextSelected]}>{value === 'tasks' ? `To do · ${data.tasks.length}` : `Today’s Focus · ${focusBlocks.length}`}</Text></Pressable>)}</View>
      {tab === 'tasks' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} keyboardShouldPersistTaps="handled"><Pill label="All subjects" selected={subjectId === null} onPress={() => setSubjectId(null)} />{data.subjects.map(subject => <Pill key={subject.id} label={subject.name} color={subject.color} selected={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}<Pill label="＋ Subject" disabled={disabled} onPress={() => setEntry('subject')} /></ScrollView>}
      <View style={s.sectionHeading}><Text style={s.sectionTitle}>{tab === 'tasks' ? 'Small steps, big things.' : 'A little time for you.'}</Text><Text style={s.sectionCount}>{rows.length.toString().padStart(2, '0')}</Text></View>
    </>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList data={rows} keyExtractor={item => item.kind === 'task' ? `task-${item.task.id}` : `block-${item.block.id}`} contentContainerStyle={s.content}
        ListHeaderComponent={header} refreshing={data.refreshing && data.ready} onRefresh={() => { if (!busyRef.current) void data.refresh(); }} initialNumToRender={8}
        renderItem={({ item }) => item.kind === 'task'
          ? <TaskCard task={item.task} disabled={disabled} onSchedule={minutes => { setActionError(''); setSchedule({ task: item.task, initialDuration: minutes ?? 30 }); }} />
          : <FocusCard block={item.block} today={today} clock={clock} busy={disabled} working={workingBlock === item.block.id} onDone={() => void complete(item.block.id)}
            onReschedule={() => setSchedule({ task: { id: item.block.task_id, title: item.block.task_title, subject_name: item.block.subject_name }, sourceBlock: item.block, initialDuration: Math.max(1, Math.round((Date.parse(item.block.end_time) - Date.parse(item.block.start_time)) / 60000)) })} />}
        ListEmptyComponent={!data.ready && data.refreshing ? <ActivityIndicator color={p.accent} style={s.loader} /> : !data.error ? <View style={s.empty}><Text style={s.emptyMark}>{tab === 'tasks' ? '✳' : '◷'}</Text><Text style={s.emptyTitle}>{tab === 'tasks' ? 'Start with one thing.' : 'Your day has room.'}</Text><Text style={s.emptyText}>{tab === 'tasks' ? 'Add a task, give it a home, and take the next small step.' : 'Choose a task and set aside a little time. You set the pace.'}</Text>{tab === 'focus' && <Button label="Find a small step ↗" tone="outline" compact onPress={() => setTab('tasks')} />}</View> : null}
        ListFooterComponent={<Text style={s.footer}>PROGRESS, AT YOUR PACE.</Text>} />
      <SafeAreaView edges={['bottom']} style={s.bottomBar}><View style={s.bottomInner}><View style={s.flex}><Text style={s.bottomKicker}>NO PERFECT DAYS REQUIRED</Text><Text style={s.bottomText}>Just a next step.</Text></View><Button label={data.subjects.length ? '＋ New task' : '＋ First subject'} disabled={disabled} onPress={() => setEntry(data.subjects.length ? 'task' : 'subject')} /></View></SafeAreaView>
      {entry && <EntrySheet key={entry} kind={entry} userId={user.id} subjects={data.subjects} initialSubject={subjectId} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); setNotice(entry === 'subject' ? 'A new home for your learning. Add a task when you’re ready.' : 'One small step, ready when you are.'); void data.refresh(); }} />}
      {schedule && <ScheduleSheet userId={user.id} {...schedule} onClose={() => setSchedule(null)} onSaved={savedSession} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: p.background }, flex: { flex: 1 }, pressed: { opacity: 0.8 }, content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 }, wordmark: { color: p.text, fontSize: 29, fontWeight: '700', letterSpacing: -1.5 }, accent: { color: p.accent }, account: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, accountText: { color: p.muted, fontSize: 12, fontWeight: '500' },
  date: { color: p.muted, fontSize: 9, letterSpacing: 1.8, fontWeight: '600', marginBottom: 16 }, greeting: { color: p.text, fontSize: 38, lineHeight: 43, letterSpacing: -1.7, fontWeight: '400' }, name: { color: p.accent, fontStyle: 'italic' }, intro: { color: p.muted, fontSize: 13, lineHeight: 21, marginTop: 16, marginBottom: 28 },
  dayCard: { backgroundColor: '#292338', borderRadius: 24, padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#473A60' }, orbit: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#514264', position: 'absolute', right: -44, top: -36 }, dayKicker: { color: p.accent, fontSize: 9, letterSpacing: 2, fontWeight: '600' },
  dayNumbers: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, marginBottom: 22 }, dayMinutes: { color: p.text, fontSize: 43, fontWeight: '500', letterSpacing: -2 }, dayCaption: { color: p.muted, fontSize: 12, lineHeight: 19 }, meter: { height: 3, backgroundColor: '#51435F', borderRadius: 2, overflow: 'hidden' }, meterFill: { height: '100%', borderRadius: 2 },
  dayBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginTop: 14 }, dayNote: { color: p.muted, fontSize: 11, lineHeight: 17, flex: 1 }, dayArrow: { color: p.accent, fontSize: 24 }, smallStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginVertical: 20 }, statsText: { color: p.muted, fontSize: 11 }, statNumber: { color: p.text, fontWeight: '600' }, statDot: { height: 3, width: 3, borderRadius: 2, backgroundColor: p.line },
  tabs: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderBottomColor: p.line, marginBottom: 18 }, tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabSelected: { borderBottomColor: p.accent }, tabText: { color: p.muted, fontSize: 13, fontWeight: '500' }, tabTextSelected: { color: p.text }, filters: { gap: 8, paddingBottom: 6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 16 }, sectionTitle: { color: p.text, fontSize: 18, letterSpacing: -0.4, fontWeight: '500', flex: 1 }, sectionCount: { color: p.muted, fontSize: 11, marginLeft: 8 },
  taskCard: { backgroundColor: p.surface, borderRadius: 22, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#2B2C3B' }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }, subjectDot: { height: 7, width: 7, borderRadius: 4 }, cardSubject: { flex: 1, color: p.muted, fontSize: 11, letterSpacing: 0.3 }, taskNumber: { color: '#777687', fontSize: 11 }, taskTitle: { color: p.text, fontSize: 21, lineHeight: 29, fontWeight: '500', letterSpacing: -0.45 }, cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 22 }, taskHint: { color: p.muted, fontSize: 11, lineHeight: 18 },
  coaching: { backgroundColor: p.warmSoft, borderLeftWidth: 2, borderLeftColor: p.warm, padding: 14, borderRadius: 12, marginTop: 18 }, coachKicker: { color: p.warm, fontSize: 8, fontWeight: '700', letterSpacing: 1.3, marginBottom: 8 }, coachText: { color: p.text, fontSize: 13, lineHeight: 21 }, microButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, microText: { color: p.warm, fontSize: 12, fontWeight: '600' },
  focusCard: { padding: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: '#2B2C3B', borderRadius: 22, marginBottom: 12 }, focusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, focusTime: { color: p.text, fontSize: 21, letterSpacing: -0.5 }, badge: { color: p.muted, backgroundColor: p.raised, fontSize: 10, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 }, activeBadge: { color: p.accent, backgroundColor: p.accentSoft }, missedBadge: { color: p.warm, backgroundColor: p.warmSoft }, doneBadge: { color: p.green, backgroundColor: p.greenSoft },
  focusBody: { flexDirection: 'row', gap: 14, marginVertical: 22 }, timelineLine: { width: 2, borderRadius: 1 }, focusTitle: { color: p.text, fontSize: 18, lineHeight: 26, marginVertical: 8 }, oldDate: { color: p.muted, fontSize: 11, marginTop: 6 }, recovery: { backgroundColor: p.warmSoft, borderRadius: 14, padding: 14 }, recoveryNote: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }, emptyMark: { color: p.accent, fontSize: 48, marginBottom: 18 }, emptyTitle: { color: p.text, fontSize: 22, letterSpacing: -0.6, marginBottom: 10 }, emptyText: { color: p.muted, fontSize: 13, lineHeight: 22, textAlign: 'center', marginBottom: 20 }, loader: { marginVertical: 32 }, footer: { color: '#777687', fontSize: 8, letterSpacing: 2, textAlign: 'center', paddingVertical: 28 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 }, dismiss: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' }, bottomBar: { backgroundColor: p.background, borderTopWidth: 1, borderTopColor: p.line }, bottomInner: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 14 }, bottomKicker: { color: p.muted, fontSize: 7, letterSpacing: 1 }, bottomText: { color: p.text, fontSize: 14, marginTop: 6 },
});
