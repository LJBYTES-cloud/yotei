import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getLocalDateKey } from '../db/dateUtils';
import { useStudy } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { formatMinutes, formatTime } from './theme';
import { Button, Message } from './ui';

/** @param {{title: string, edition?: string, eyebrow?: string, children?: import('react').ReactNode, subtitle: string}} props */
export function ScreenHeader({ title, edition, eyebrow, children, subtitle }) {
  const s = useThemedStyles(createStudyStyles);
  return <>
    <View style={s.masthead}><Text style={s.wordmark}>yotei<Text style={s.accent}>.</Text></Text>{edition && <Text style={s.edition}>{edition}</Text>}</View>
    {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={s.heading}>{title}</Text>{children && <Text style={s.headerDeck}>{children}</Text>}<Text style={s.intro}>{subtitle}</Text>
  </>;
}

export function Feedback() {
  const { error, notice, dismissNotice, data, refresh } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  return <>
    {Boolean(error) && <View style={s.card}><Message text={error} />{data.error && <Button label="Try refreshing" tone="outline" onPress={refresh} />}</View>}
    {Boolean(notice) && <View style={[s.card, s.notice]}><View style={s.flex}><Message text={notice} kind="notice" /></View><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={dismissNotice} style={s.dismiss}><Text style={s.dismissText}>×</Text></Pressable></View>}
  </>;
}

/** @param {{task: import('../db/TaskService').Task}} props */
export function CoachingCard({ task }) {
  const { disabled, openSchedule } = useStudy();
  const s = useThemedStyles(createStudyStyles);
  return <View style={s.coaching}>
    <Text style={s.coachingLabel}>POSTPONED TASK</Text>
    <Text style={s.coachingText}>This task has been postponed at least twice. Try a 5-minute session.</Text>
    <Text style={[s.hint, { marginTop: 16 }]}>{task.title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Schedule a 5-minute start for ${task.title}`} disabled={disabled} onPress={() => openSchedule(task, 5)} style={s.coachingAction}>
      <Text style={s.coachingActionText}>Schedule 5 minutes</Text>
    </Pressable>
  </View>;
}

/** @param {{task: import('../db/TaskService').Task}} props */
export function TaskCard({ task }) {
  const { disabled, openSchedule } = useStudy();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  return <View style={s.card}>
    <View style={s.cardTop}><View style={[s.dot, { backgroundColor: subjectColor(task.subject_color) }]} /><Text style={s.subject}>{task.subject_name}</Text></View>
    <Text style={s.title}>{task.title}</Text>
    {task.postpone_count >= 2 && <CoachingCard task={task} />}
    <View style={s.cardBottom}>
      {task.postpone_count > 0 && <Text style={s.hint}>{`Postponed ${task.postpone_count} ${task.postpone_count === 1 ? 'time' : 'times'}`}</Text>}
      <Button label="Schedule ↗" compact tone="quiet" disabled={disabled} onPress={() => openSchedule(task)} />
    </View>
  </View>;
}

/** @param {{block: import('../db/StudyBlockService').StudyBlock}} props */
export function FocusCard({ block }) {
  const { clock, today, disabled, workingBlock, complete, openReschedule } = useStudy();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const active = block.status === 'scheduled' && Date.parse(block.start_time) <= clock && Date.parse(block.end_time) >= clock;
  const missed = block.status === 'missed' && !block.rescheduled_to;
  const status = block.rescheduled_to ? 'Replanned' : block.status === 'done' ? 'Done' : missed ? 'Missed' : active ? 'In progress' : 'Scheduled';
  return <View style={s.card}>
    <View style={s.focusTop}><Text style={s.focusTime}>{formatTime(block.start_time)}</Text><Text style={[s.badge, active && s.activeBadge, missed && s.missedBadge, block.status === 'done' && s.doneBadge]}>{status}</Text></View>
    {getLocalDateKey(new Date(block.start_time)) !== today && <Text style={s.oldDate}>{new Date(block.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>}
    <View style={s.focusBody}><View style={[s.timeline, { backgroundColor: subjectColor(block.subject_color) }]} /><View style={s.flex}><Text style={s.subject}>{block.subject_name}</Text><Text style={s.focusTitle}>{block.task_title}</Text><Text style={s.hint}>{formatMinutes((Date.parse(block.end_time) - Date.parse(block.start_time)) / 60000)} · until {formatTime(block.end_time)}</Text></View></View>
    {active && <Button label="Mark Done ✓" tone="quiet" busy={workingBlock === block.id} disabled={disabled} onPress={() => void complete(block.id)} />}
    {missed && <View style={s.recovery}><Text style={s.coachingText}>This session was missed.</Text><Text style={s.hint}>Choose new start and end times to reschedule.</Text><Button label="Reschedule" tone="quiet" disabled={disabled} onPress={() => openReschedule(block)} /></View>}
  </View>;
}

/** @param {{title: string, text: string, action?: string, onPress?: () => void}} props */
export function EmptyState({ title, text, action, onPress }) {
  const { data } = useStudy();
  const { colors } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  if (!data.ready && data.refreshing) return <ActivityIndicator color={colors.accent} style={s.loader} />;
  if (data.error) return null;
  return <View style={[s.card, s.empty]}><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyText}>{text}</Text>{action && onPress && <Button label={action} onPress={onPress} />}</View>;
}
