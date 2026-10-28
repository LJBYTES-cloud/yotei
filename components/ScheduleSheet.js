import { fonts, typeScale, typeLeading } from './typography';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { createStudyBlock, rescheduleStudyBlock } from '../db/StudyBlockService';
import { StudyLoadWarning } from '../db/StudyLoadService';
import { applyStudyDuration, buildStudyTimes, getInitialStudyWindow, updateStudyWindow } from '../utils/scheduling';
import { Button, FieldLabel, Input, Message, Sheet } from './ui';
import DateTimeField from './DateTimeField';
import { formatMinutes } from './theme';
import { useThemedStyles } from '../ThemeContext';

/** @param {{ userId: string, task: { id: number, title: string, subject_name: string }, sourceBlock?: import('../db/StudyBlockService').StudyBlock, initialDuration?: number, onClose: () => void, onSaved: (block: import('../db/StudyBlockService').StudyBlock) => void }} props */
export default function ScheduleSheet({ userId, task, sourceBlock, initialDuration = 30, onClose, onSaved }) {
  const s = useThemedStyles(createStyles);
  const [window, setWindow] = useState(() => getInitialStudyWindow(new Date(), initialDuration));
  const windowRef = useRef(window);
  const [duration, setDuration] = useState('');
  const durationRef = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(/** @type {{ days: import('../db/StudyLoadService').StudyLoad[], times: {start_time: string, end_time: string} } | null} */ (null));
  const submitting = useRef(false);
  let durationError = '';
  if (duration.trim()) {
    try { applyStudyDuration(window, duration); }
    catch (cause) { durationError = cause instanceof Error ? cause.message : 'Enter a valid duration.'; }
  }

  /** @param {string} value */
  function changeDuration(value) {
    durationRef.current = value; setDuration(value); setError('');
    if (!value.trim()) return;
    try {
      // Every edit is anchored to Start, never to the previously calculated End.
      const next = applyStudyDuration({ start: windowRef.current.start, end: windowRef.current.start }, value);
      windowRef.current = next; setWindow(next);
    } catch { /* Keep the draft and previous dates; invalid input cannot be saved. */ }
  }

  /** @param {'start' | 'end'} field @param {Date} picked @param {'date' | 'time'} part */
  function changeWindow(field, picked, part) {
    try {
      const next = updateStudyWindow(windowRef.current, field, part, picked);
      windowRef.current = next;
      setWindow(next);
      // Editing End directly takes precedence over the duration shortcut.
      if (field === 'end') { durationRef.current = ''; setDuration(''); }
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Choose a valid date and time.'); }
  }

  /** @param {boolean} [proceed] */
  async function submit(proceed = false) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    /** @type {{start_time: string, end_time: string} | null} */
    let proposedTimes = null;
    try {
      const times = proceed && warning
        ? buildStudyTimes({ start: new Date(warning.times.start_time), end: new Date(warning.times.end_time) }, new Date())
        : buildStudyTimes(durationRef.current.trim() ? applyStudyDuration(windowRef.current, durationRef.current) : windowRef.current, new Date());
      proposedTimes = times;
      const block = sourceBlock
        ? await rescheduleStudyBlock(userId, sourceBlock.id, new Date().toISOString(), { ...times, allowHeavyDay: proceed })
        : await createStudyBlock(userId, { task_id: task.id, ...times }, { allowHeavyDay: proceed });
      onSaved(block);
    } catch (cause) {
      if (cause instanceof StudyLoadWarning && proposedTimes) {
        // Preserve the exact proposed times across the confirmation step.
        setWarning({ days: cause.days, times: proposedTimes });
      } else setError(!proposedTimes && cause instanceof Error ? cause.message : 'We couldn’t save your session. Your choices are still here; please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstEndDay = new Date(window.start); firstEndDay.setHours(0, 0, 0, 0);
  return (
    <Sheet title={sourceBlock ? 'Reschedule Session' : 'Schedule Session'} kicker="Study Session" onClose={onClose} busy={busy}>
      <View style={s.task}><Text style={s.subject}>{task.subject_name}</Text><Text style={s.taskTitle}>{task.title}</Text></View>
      {warning ? (
        <View accessibilityRole="alert" style={s.warning}>
          <Text style={s.warningKicker}>WORKLOAD WARNING</Text>
          <FieldLabel label="Daily Study Time Exceeds 4 Hours" textStyle={s.warningTitle} help="This includes scheduled and completed sessions. Adjust the selected dates/times to reduce the workload, or choose Schedule Anyway to continue." />
          {warning.days.map(day => <Text key={day.date} style={s.warningDetail}>{day.date} · {formatMinutes(day.current_minutes)} already planned + {formatMinutes(day.added_minutes)} = {formatMinutes(day.total_minutes)}</Text>)}
          <Message text={error} />
          <Button label="Schedule Anyway" busy={busy} onPress={() => void submit(true)} />
          <View style={s.gap} /><Button label="Adjust Session" tone="quiet" disabled={busy} onPress={() => { setWarning(null); setError(''); }} />
        </View>
      ) : (
        <>
          <DateTimeField label="Start" help="Choose any upcoming date and local time. Changing the start keeps the current session length."
            value={window.start} minimumDate={today} disabled={busy} onChange={(picked, part) => changeWindow('start', picked, part)} />
          <Input label="Duration (Optional)" help="Type 4h 30m, 45m, 2h, or a whole number of minutes to calculate End from Start. Moving Start keeps that duration; editing End clears this shortcut."
            value={duration} onChangeText={changeDuration} placeholder="e.g. 4h 30m" autoCapitalize="none" autoCorrect={false} maxLength={40} editable={!busy} returnKeyType="done" onSubmitEditing={() => void submit()} />
          <DateTimeField label="End" help="Choose a date/time after the start. Overnight sessions can end on a later calendar date."
            value={window.end} minimumDate={firstEndDay} disabled={busy} onChange={(picked, part) => changeWindow('end', picked, part)} />
          <Message text={durationError || error} />
          <Button label={sourceBlock ? 'Reschedule Session ↗' : 'Save Session'} disabled={Boolean(durationError)} busy={busy} onPress={() => void submit()} />
        </>
      )}
    </Sheet>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  task: { borderLeftWidth: 2, borderLeftColor: p.accent, paddingLeft: 16, marginBottom: 36 }, subject: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, marginBottom: 7 }, taskTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal' },
  warning: { padding: 20, borderRadius: 20, backgroundColor: p.warmSoft, borderWidth: 1, borderColor: p.line }, warningKicker: { fontFamily: fonts.bold, color: p.warm, fontSize: typeScale.small, lineHeight: typeLeading.small, letterSpacing: 1.5, fontWeight: 'normal', marginBottom: 20 },
  warningTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h2, lineHeight: typeLeading.h2, letterSpacing: -0.6 }, warningDetail: { fontFamily: fonts.body, color: p.warm, fontSize: typeScale.small, lineHeight: typeLeading.small, marginBottom: 20 }, gap: { height: 20 },
});
