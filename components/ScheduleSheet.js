import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { createStudyBlock, rescheduleStudyBlock } from '../db/StudyBlockService';
import { StudyLoadWarning } from '../db/StudyLoadService';
import { buildStudyTimes, getInitialStudyWindow, updateStudyWindow } from '../utils/scheduling';
import { Button, FieldLabel, Message, Sheet } from './ui';
import DateTimeField from './DateTimeField';
import { formatMinutes } from './theme';
import { useThemedStyles } from '../ThemeContext';

/** @param {{ userId: string, task: { id: number, title: string, subject_name: string }, sourceBlock?: import('../db/StudyBlockService').StudyBlock, initialDuration?: number, onClose: () => void, onSaved: (block: import('../db/StudyBlockService').StudyBlock) => void }} props */
export default function ScheduleSheet({ userId, task, sourceBlock, initialDuration = 30, onClose, onSaved }) {
  const s = useThemedStyles(createStyles);
  const [window, setWindow] = useState(() => getInitialStudyWindow(new Date(), initialDuration));
  const windowRef = useRef(window);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(/** @type {{ days: import('../db/StudyLoadService').StudyLoad[], times: {start_time: string, end_time: string} } | null} */ (null));
  const submitting = useRef(false);

  /** @param {'start' | 'end'} field @param {Date} picked @param {'date' | 'time'} part */
  function changeWindow(field, picked, part) {
    try {
      const next = updateStudyWindow(windowRef.current, field, part, picked);
      windowRef.current = next;
      setWindow(next);
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
        : buildStudyTimes(windowRef.current, new Date());
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
    <Sheet title={sourceBlock ? 'Reschedule session' : 'Schedule session'} kicker="STUDY SESSION" onClose={onClose} busy={busy}>
      <View style={s.task}><Text style={s.subject}>{task.subject_name}</Text><Text style={s.taskTitle}>{task.title}</Text></View>
      {warning ? (
        <View accessibilityRole="alert" style={s.warning}>
          <Text style={s.warningKicker}>WORKLOAD WARNING</Text>
          <FieldLabel label="Daily study time exceeds 4 hours" textStyle={s.warningTitle} help="This includes scheduled and completed sessions. Adjust the selected dates/times to reduce the workload, or choose Schedule anyway to continue." />
          {warning.days.map(day => <Text key={day.date} style={s.warningDetail}>{day.date} · {formatMinutes(day.current_minutes)} already planned + {formatMinutes(day.added_minutes)} = {formatMinutes(day.total_minutes)}</Text>)}
          <Message text={error} />
          <Button label="Schedule anyway" busy={busy} onPress={() => void submit(true)} />
          <View style={s.gap} /><Button label="Adjust session" tone="quiet" disabled={busy} onPress={() => { setWarning(null); setError(''); }} />
        </View>
      ) : (
        <>
          <DateTimeField label="Start" help="Choose any upcoming date and local time. Changing the start keeps the current session length."
            value={window.start} minimumDate={today} disabled={busy} onChange={(picked, part) => changeWindow('start', picked, part)} />
          <DateTimeField label="End" help="Choose a date/time after the start. Overnight sessions can end on a later calendar date."
            value={window.end} minimumDate={firstEndDay} disabled={busy} onChange={(picked, part) => changeWindow('end', picked, part)} />
          <Message text={error} />
          <Button label={sourceBlock ? 'Reschedule session ↗' : 'Save session'} busy={busy} onPress={() => void submit()} />
        </>
      )}
    </Sheet>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  task: { borderLeftWidth: 2, borderLeftColor: p.accent, paddingLeft: 16, marginBottom: 36 }, subject: { color: p.muted, fontSize: 12, marginBottom: 7 }, taskTitle: { color: p.text, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  warning: { padding: 20, borderRadius: 20, backgroundColor: p.warmSoft, borderWidth: 1, borderColor: p.line }, warningKicker: { color: p.warm, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 20 },
  warningTitle: { color: p.text, fontSize: 22, lineHeight: 29, letterSpacing: -0.6 }, warningDetail: { color: p.warm, fontSize: 12, lineHeight: 21, marginBottom: 20 }, gap: { height: 20 },
});
