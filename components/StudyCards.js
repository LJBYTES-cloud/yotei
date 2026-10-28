import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getLocalDateKey } from '../db/dateUtils';
import { useStudy, useStudyList } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { formatMinutes } from './theme';
import { useTimeFormat } from '../TimeFormatContext';
import { Button, FieldLabel, InfoButton, Message } from './ui';
import { formatElapsed } from '../utils/focusTimer';
import ItemActionsMenu from './ItemActionsMenu';
import BrandLogo from './BrandLogo';

/** @param {{title: string, edition?: string, eyebrow?: string, children?: import('react').ReactNode, subtitle?: string, badge?: string, action?: import('react').ReactNode}} props */
export function ScreenHeader({ title, edition, eyebrow, children, subtitle, badge, action }) {
  const s = useThemedStyles(createStudyStyles);
  return <>
    <View style={s.masthead}>
      <View style={s.brandLockup}><BrandLogo /><Text style={s.wordmark}>yotei<Text style={s.accent}>.</Text></Text></View>
      {edition && <Text style={s.edition}>{edition}</Text>}
    </View>
    {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
    <View style={s.screenTitleRow}>
      <View style={s.screenTitleGroup}><Text accessibilityRole="header" style={s.screenTitle}>{title}</Text>
        {badge !== undefined && <Text accessibilityLabel={`${badge} subjects`} style={s.titleBadge}>{badge}</Text>}
        {subtitle && <InfoButton title={title} message={subtitle} />}
      </View>
      {action}
    </View>
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
  const { disabled, openSchedule } = useStudyList();
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
function TaskCardView({ task, hasMissedSession = false, notebook = false }) {
  const { disabled, openSchedule, openEditTask, confirmDeleteTask, deletingTask } = useStudyList();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  return <View style={[s.card, notebook && s.notebookTask]}>
    <View style={s.cardTop}><View style={[s.dot, { backgroundColor: subjectColor(task.subject_color) }]} /><Text style={[s.subject, { flex: 1 }]}>{task.subject_name}</Text>
      <ItemActionsMenu label={task.title} disabled={disabled} busy={deletingTask === task.id} onEdit={() => openEditTask(task)} onDelete={() => confirmDeleteTask(task)} />
    </View>
    <Text style={s.title}>{task.title}</Text>
    {notebook && Boolean(task.description) && <Text style={[s.hint, { marginTop: 12 }]}>{task.description}</Text>}
    {hasMissedSession && <Text style={[s.badge, s.missedBadge, { alignSelf: 'flex-start', marginTop: 16 }]}>Missed Session</Text>}
    {task.postpone_count >= 2 && <CoachingCard task={task} />}
    <View style={s.cardBottom}>
      {task.postpone_count > 0 && <Text style={s.hint}>{`Postponed ${task.postpone_count} ${task.postpone_count === 1 ? 'time' : 'times'}`}</Text>}
      <Button label="Schedule ↗" compact tone="quiet" disabled={disabled} onPress={() => openSchedule(task)} />
    </View>
  </View>;
}

export const TaskCard = memo(TaskCardView);

/** Narrow props keep unrelated workspace ticks from re-rendering static cards.
 * @param {{block: import('../db/StudyBlockService').StudyBlock, today: string,
 * readyToStart: boolean, disabled: boolean, working: boolean,
 * onStart: (id: number) => void, onReschedule: (block: import('../db/StudyBlockService').StudyBlock) => void,
 * onMarkDone: (id: number) => void, onDelete: (block: import('../db/StudyBlockService').StudyBlock) => void}} props */
function FocusCardView({ block, today, readyToStart: active, disabled, working, onStart, onReschedule, onMarkDone, onDelete }) {
  const { formatTime } = useTimeFormat();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const missed = block.status === 'missed' && !block.rescheduled_to;
  const status = block.rescheduled_to ? 'Replanned' : block.status === 'done' ? 'Done' : missed ? 'Missed' : active ? 'Ready to Start' : 'Scheduled';
  return <View style={s.card}>
    <View style={s.focusTop}><Text style={s.focusTime}>{formatTime(block.start_time)}</Text>
      <View style={s.focusControls}>
        <Text style={[s.badge, s.focusStatus, active && s.activeBadge, missed && s.missedBadge, block.status === 'done' && s.doneBadge]}>{status}</Text>
        {block.status === 'scheduled' && <ItemActionsMenu label={block.task_title} disabled={disabled} busy={working} actions={[
          { label: 'Mark as Done', onPress: () => onMarkDone(block.id) },
          { label: 'Delete Block', tone: 'danger', onPress: () => onDelete(block) },
        ]} />}
      </View>
    </View>
    {getLocalDateKey(new Date(block.start_time)) !== today && <Text style={s.oldDate}>{new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>}
    <View style={s.focusBody}><View style={[s.timeline, { backgroundColor: subjectColor(block.subject_color) }]} /><View style={s.flex}><Text style={s.subject}>{block.subject_name}</Text><Text style={s.focusTitle}>{block.task_title}</Text><Text style={s.hint}>{formatMinutes((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000)} · until {formatTime(block.end_time)}</Text></View></View>
    {block.status === 'done' && block.actual_end_time !== null && <Text style={[s.hint, { marginBottom: 20 }]}>{formatElapsed(block.actual_study_seconds)} studied · {block.actual_start_time === null ? 'Marked Done' : `${block.break_time_minutes} min breaks`}</Text>}
    {block.status === 'scheduled' && <Button label="Start Session" tone="primary"
      busy={working} disabled={disabled || !active} onPress={() => onStart(block.id)} />}
    {missed && <View style={s.recovery}><FieldLabel label="Missed Session" textStyle={s.coachingText} help="Reschedule with new dates and times. Each reschedule increases this task's postponement count once." /><Button label="Reschedule" tone="quiet" disabled={disabled} onPress={() => onReschedule(block)} /></View>}
  </View>;
}

export const FocusCard = memo(FocusCardView);

/** @param {{title: string, text: string, action?: string, onPress?: () => void}} props */
export function EmptyState({ title, text, action, onPress }) {
  const { data } = useStudy();
  const { colors } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  if (!data.ready && data.refreshing) return <ActivityIndicator color={colors.accent} style={s.loader} />;
  if (data.error) return null;
  return <View style={[s.card, s.empty]}><FieldLabel label={title} textStyle={s.emptyTitle} help={text} />{action && onPress && <Button label={action} onPress={onPress} />}</View>;
}
