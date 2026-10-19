import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { createStudyBlock, rescheduleStudyBlock } from '../db/StudyBlockService';
import { StudyLoadWarning } from '../db/StudyLoadService';
import { buildStudyTimes } from '../utils/scheduling';
import { Button, Input, Message, Pill, Sheet } from './ui';
import { formatMinutes, palette as p } from './theme';

/** @param {{ userId: string, task: { id: number, title: string, subject_name: string }, sourceBlock?: import('../db/StudyBlockService').StudyBlock, initialDuration?: number, onClose: () => void, onSaved: (block: import('../db/StudyBlockService').StudyBlock) => void }} props */
export default function ScheduleSheet({ userId, task, sourceBlock, initialDuration = 30, onClose, onSaved }) {
  const [duration, setDuration] = useState(String(initialDuration));
  const [mode, setMode] = useState(/** @type {'now' | 'custom'} */ ('now'));
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(/** @type {{ days: import('../db/StudyLoadService').StudyLoad[], times: {start_time: string, end_time: string} } | null} */ (null));
  const submitting = useRef(false);

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
      const times = proceed && warning ? warning.times : buildStudyTimes({ duration, mode, time }, new Date());
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

  return (
    <Sheet title={sourceBlock ? 'A fresh start.' : 'Make a little room.'} kicker="PLAN A FOCUS SESSION" onClose={onClose} busy={busy}>
      <View style={s.task}><Text style={s.subject}>{task.subject_name}</Text><Text style={s.taskTitle}>{task.title}</Text></View>
      {warning ? (
        <View accessibilityRole="alert" style={s.warning}>
          <Text style={s.warningKicker}>A MOMENT TO CHECK IN</Text>
          <Text style={s.warningTitle}>Leave room to breathe.</Text>
          <Text style={s.warningBody}>You’re planning a heavy day. Remember to take breaks.</Text>
          {warning.days.map(day => <Text key={day.date} style={s.warningDetail}>{day.date} · {formatMinutes(day.current_minutes)} already planned + {formatMinutes(day.added_minutes)} = {formatMinutes(day.total_minutes)}</Text>)}
          <Text style={s.warningBody}>That’s over 4 hours of study. Keep this session if it feels right, or make the plan lighter.</Text>
          <Message text={error} />
          <Button label="Schedule anyway" busy={busy} onPress={() => void submit(true)} />
          <View style={s.gap} /><Button label="Go back & adjust" tone="quiet" disabled={busy} onPress={() => { setWarning(null); setError(''); }} />
        </View>
      ) : (
        <>
          <Input label="How much time?" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="e.g. 25" editable={!busy} maxLength={6} returnKeyType="done" />
          <Text style={s.help}>Minutes. Five is a perfectly good start.</Text>
          <Text style={s.label}>When would you like to begin?</Text>
          <View style={s.choices}><Pill label="Now" selected={mode === 'now'} disabled={busy} onPress={() => setMode('now')} /><Pill label="Pick a time" selected={mode === 'custom'} disabled={busy} onPress={() => setMode('custom')} /></View>
          {mode === 'custom' && <><Input label="Start time today · 24-hour clock" value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} editable={!busy} autoCorrect={false} /><Text style={s.help}>Your local time. Choose a time later today.</Text></>}
          <Message text={error} />
          <Button label={sourceBlock ? 'Reschedule session ↗' : 'Save my focus session ↗'} busy={busy} onPress={() => void submit()} />
          <Text style={s.footnote}>Make a plan that leaves space for being human.</Text>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  task: { borderLeftWidth: 2, borderLeftColor: p.accent, paddingLeft: 16, marginBottom: 28 }, subject: { color: p.muted, fontSize: 12, marginBottom: 7 }, taskTitle: { color: p.text, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  label: { color: p.muted, fontSize: 12, fontWeight: '600', marginBottom: 12 }, help: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: -9, marginBottom: 24 },
  choices: { flexDirection: 'row', gap: 10, marginBottom: 24 }, footnote: { color: p.muted, fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 18 },
  warning: { padding: 18, borderRadius: 20, backgroundColor: p.warmSoft, borderWidth: 1, borderColor: '#64503A' }, warningKicker: { color: p.warm, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 12 },
  warningTitle: { color: p.text, fontSize: 25, lineHeight: 31, letterSpacing: -0.6, marginBottom: 12 }, warningBody: { color: p.text, fontSize: 14, lineHeight: 22, marginBottom: 16 }, warningDetail: { color: p.warm, fontSize: 12, lineHeight: 21, marginBottom: 12 }, gap: { height: 10 },
});
