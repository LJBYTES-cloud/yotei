import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getStudyDayDetails } from '../db/ProgressService';
import { fonts, typeScale, typeLeading } from './typography';
import InfoModal from './InfoModal';
import { useTimeFormat } from '../TimeFormatContext';

/** @param {string} date */
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
/** @param {number} minutes */
const minutes = minutes => `${minutes.toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;

/** @param {{userId: string, days: import('../db/ProgressService').StudyProgressDay[], selection: string, onDay: (date: string) => void, onClose: () => void}} props */
export default function ProgressDetailsModal({ userId, days, selection, onDay, onClose }) {
  const { colors: p } = useTheme(), s = useThemedStyles(createStyles);
  const { formatTime, formatDateTime } = useTimeFormat();
  const [sessions, setSessions] = useState(/** @type {import('../db/ProgressService').StudyDaySession[]} */ ([]));
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (selection === 'week') return;
    let cancelled = false;
    void getStudyDayDetails(userId, selection).then(rows => { if (!cancelled) { setSessions(rows); setReady(true); } })
      .catch(() => { if (!cancelled) setError('Could not load session details. Close and try again.'); });
    return () => { cancelled = true; };
  }, [userId, selection]);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const best = days.reduce((best, day) => !best || day.minutes > best.minutes ? day : best, /** @type {import('../db/ProgressService').StudyProgressDay | null} */ (null));
  const dayTotal = sessions.reduce((sum, row) => sum + row.studied_minutes, 0);
  return <InfoModal title={selection === 'week' ? 'Weekly Summary' : dateLabel(selection)} onClose={onClose}>
    {selection === 'week' ? <View style={s.stack}>
      <View><Text style={s.label}>Total Studied This Week</Text><Text style={s.value}>{minutes(total)}</Text></View>
      <View><Text style={s.label}>Daily Average</Text><Text style={s.value}>{minutes(total / 7)}</Text></View>
      <View><Text style={s.label}>Best Day</Text><Text style={s.body}>{best && best.minutes > 0 ? `${dateLabel(best.date)} · ${minutes(best.minutes)}` : 'No Completed Sessions'}</Text></View>
      {days.map(day => <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={`View ${dateLabel(day.date)}`} onPress={() => onDay(day.date)} style={s.day}>
        <Text style={s.body}>{dateLabel(day.date)}</Text><Text style={s.body}>{minutes(day.minutes)}</Text>
      </Pressable>)}
    </View> : error ? <Text accessibilityRole="alert" style={[s.body, { color: p.error }]}>{error}</Text> : !ready ? <ActivityIndicator accessibilityLabel="Loading Session Details" color={p.accent} /> : <View style={s.stack}>
      <View><Text style={s.label}>Total Minutes</Text><Text style={s.value}>{minutes(dayTotal)}</Text></View>
      {sessions.length === 0 && <Text style={s.body}>No Completed Sessions</Text>}
      {sessions.map(row => <View key={row.id} style={s.session}>
        <Text style={s.label}>{row.subject_name}</Text><Text style={s.task}>{row.task_title}</Text>
        <Text style={s.label}>{formatTime(row.start_time)}–{formatTime(row.end_time)}</Text>
        {row.actual_end_time && <Text style={s.label}>{row.actual_start_time ? 'Finished' : 'Marked Done'}: {formatDateTime(row.actual_end_time)}</Text>}
        <View style={[s.comparison, row.overrun_minutes > 0 && s.heavy]}>
          <Text style={s.body}>Scheduled: {minutes(row.planned_minutes)} | Actual: {minutes(row.elapsed_minutes)}</Text>
          <Text style={row.overrun_minutes > 0 ? s.overrun : s.body}>Overrun: +{minutes(row.overrun_minutes)}</Text>
        </View>
        <Text style={s.body}>{row.actual_start_time ? 'Studied' : 'Studied (Untimed)'}: {minutes(row.studied_minutes)}</Text>
        <Text style={s.body}>Breaks: {minutes(row.break_minutes)} · Elapsed: {minutes(row.elapsed_minutes)}</Text>
        {row.finished_late_minutes > 0 && <Text style={s.overrun}>Finished {minutes(row.finished_late_minutes)} After Scheduled End</Text>}
      </View>)}
      <Text style={s.label}>Actual includes work and breaks. Overrun compares elapsed time with the scheduled allocation; a late finish is shown separately. Untimed completions use their scheduled duration.</Text>
    </View>}
  </InfoModal>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  stack: { gap: 24 }, label: { fontFamily: fonts.medium, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small },
  value: { fontFamily: fonts.serifBold, color: p.accent, fontSize: typeScale.h2, lineHeight: typeLeading.h2, marginTop: 6 },
  body: { fontFamily: fonts.body, color: p.text, fontSize: typeScale.body, lineHeight: typeLeading.body },
  task: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3 },
  session: { paddingTop: 20, borderTopWidth: 1, borderTopColor: p.line, gap: 10 },
  day: { borderTopWidth: 1, borderTopColor: p.line, paddingVertical: 12, gap: 8 },
  overrun: { fontFamily: fonts.medium, color: p.warm, fontSize: typeScale.small, lineHeight: typeLeading.small },
  comparison: { padding: 12, borderRadius: 10, backgroundColor: p.raised, gap: 8 }, heavy: { backgroundColor: p.warmSoft, borderWidth: 1, borderColor: p.warm },
});
