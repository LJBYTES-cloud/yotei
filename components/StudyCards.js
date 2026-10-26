import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getLocalDateKey } from '../db/dateUtils';
import { useStudy } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { formatMinutes, formatTime } from './theme';
import { Button, FieldLabel, InfoButton, Message } from './ui';
import { formatElapsed } from '../utils/focusTimer';

/** @param {{title: string, edition?: string, eyebrow?: string, children?: import('react').ReactNode, subtitle: string}} props */
export function ScreenHeader({ title, edition, eyebrow, children, subtitle }) {
  const s = useThemedStyles(createStudyStyles);
  return <>
    <View style={s.masthead}><Text style={s.wordmark}>yotei<Text style={s.accent}>.</Text></Text>{edition && <Text style={s.edition}>{edition}</Text>}</View>
    {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
    <View style={s.screenTitleRow}><Text accessibilityRole="header" style={s.screenTitle}>{title}</Text><InfoButton title={title} message={subtitle} /></View>
    {children && <Text style={s.headerDeck}>{children}</Text>}
  </>;
}

export function Feedback() {
  const { error, data, refresh } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  return <>
    {Boolean(error) && <View style={s.card}><Message text={error} />{data.error && <Button label="Try Refreshing" tone="outline" onPress={refresh} />}</View>}
  </>;
}

/** @param {{task: import('../db/TaskService').Task}} props */
export function CoachingCard({ task }) {
  const { disabled, openSchedule } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  return <View style={s.coaching}>
    <FieldLabel label="Postponed Task" textStyle={s.coachingLabel} help="This task has been postponed at least twice. A short five-minute session can help you start." />
    <Text style={s.coachingText}>Try a 5-minute start.</Text>
    <Text style={[s.hint, { marginTop: 16 }]}>{task.title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Schedule a 5-minute start for ${task.title}`} disabled={disabled} onPress={() => openSchedule(task, 5)} style={s.coachingAction}>
      <Text style={s.coachingActionText}>Schedule 5 Minutes</Text>
    </Pressable>
  </View>;
}

/** @param {{task: import('../db/TaskService').Task, hasMissedSession?: boolean, notebook?: boolean}} props */
export function TaskCard({ task, hasMissedSession = false, notebook = false }) {
  const { disabled, openSchedule, openEditTask, confirmDeleteTask, deletingTask } = useStudy();
  const { subjectColor, colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  return <View style={[s.card, notebook && s.notebookTask]}>
    <View style={s.cardTop}><View style={[s.dot, { backgroundColor: subjectColor(task.subject_color) }]} /><Text style={s.subject}>{task.subject_name}</Text></View>
    <Text style={s.title}>{task.title}</Text>
    {hasMissedSession && <Text style={[s.badge, s.missedBadge, { alignSelf: 'flex-start', marginTop: 16 }]}>Missed Session</Text>}
    {task.postpone_count >= 2 && <CoachingCard task={task} />}
    <View style={s.cardBottom}>
      {task.postpone_count > 0 && <Text style={s.hint}>{`Postponed ${task.postpone_count} ${task.postpone_count === 1 ? 'time' : 'times'}`}</Text>}
      <Button label="Schedule ↗" compact tone="quiet" disabled={disabled} onPress={() => openSchedule(task)} />
      <View style={s.taskActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} disabled={disabled} onPress={() => openEditTask(task)} style={({ pressed }) => [s.taskAction, pressed && s.pressed, disabled && { opacity: 0.4 }]}>
          <Ionicons name="pencil-outline" size={16} color={p.text} /><Text style={s.taskActionText}>Edit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.title}`} accessibilityState={{ disabled, busy: deletingTask === task.id }} disabled={disabled} onPress={() => confirmDeleteTask(task)} style={({ pressed }) => [s.taskAction, pressed && s.pressed, disabled && { opacity: 0.4 }]}>
          {deletingTask === task.id ? <ActivityIndicator size="small" color="#FF4C4C" /> : <Ionicons name="trash-outline" size={16} color="#FF4C4C" />}<Text style={s.taskDeleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

/** @param {{block: import('../db/StudyBlockService').StudyBlock}} props */
export function FocusCard({ block }) {
  const { clock, today, disabled, workingBlock, controlTimer, openReschedule, data } = useStudy();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const active = block.status === 'scheduled' && Date.parse(block.start_time) <= clock && Date.parse(block.end_time) >= clock;
  const missed = block.status === 'missed' && !block.rescheduled_to;
  const status = block.rescheduled_to ? 'Replanned' : block.status === 'done' ? 'Done' : missed ? 'Missed' : active ? 'Ready to Start' : 'Scheduled';
  return <View style={s.card}>
    <View style={s.focusTop}><Text style={s.focusTime}>{formatTime(block.start_time)}</Text><Text style={[s.badge, active && s.activeBadge, missed && s.missedBadge, block.status === 'done' && s.doneBadge]}>{status}</Text></View>
    {getLocalDateKey(new Date(block.start_time)) !== today && <Text style={s.oldDate}>{new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>}
    <View style={s.focusBody}><View style={[s.timeline, { backgroundColor: subjectColor(block.subject_color) }]} /><View style={s.flex}><Text style={s.subject}>{block.subject_name}</Text><Text style={s.focusTitle}>{block.task_title}</Text><Text style={s.hint}>{formatMinutes((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000)} · until {formatTime(block.end_time)}</Text></View></View>
    {block.status === 'done' && block.actual_start_time !== null && <Text style={[s.hint, { marginBottom: 20 }]}>{formatElapsed(block.actual_study_seconds)} studied · {block.break_time_minutes} min breaks</Text>}
    {active && <Button label="Start Session" tone="quiet" busy={workingBlock === block.id} disabled={disabled || data.blocks.some(item => item.status === 'active')} onPress={() => void controlTimer(block.id, 'start')} />}
    {missed && <View style={s.recovery}><FieldLabel label="Missed Session" textStyle={s.coachingText} help="Reschedule with new dates and times. Each reschedule increases this task's postponement count once." /><Button label="Reschedule" tone="quiet" disabled={disabled} onPress={() => openReschedule(block)} /></View>}
  </View>;
}

/** @param {{title: string, text: string, action?: string, onPress?: () => void}} props */
export function EmptyState({ title, text, action, onPress }) {
  const { data } = useStudy();
  const { colors } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  if (!data.ready && data.refreshing) return <ActivityIndicator color={colors.accent} style={s.loader} />;
  if (data.error) return null;
  return <View style={[s.card, s.empty]}><FieldLabel label={title} textStyle={s.emptyTitle} help={text} />{action && onPress && <Button label={action} onPress={onPress} />}</View>;
}
