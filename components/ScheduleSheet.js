import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { createStudyBlock, rescheduleStudyBlock } from '../db/StudyBlockService';
import { StudyLoadWarning } from '../db/StudyLoadService';
import { buildStudyTimes, getInitialStudyWindow } from '../utils/scheduling';
import { Button, Input, Message, Pill, Sheet } from './ui';
import { formatMinutes } from './theme';
import { useThemedStyles } from '../ThemeContext';

/** @param {{ userId: string, task: { id: number, title: string, subject_name: string }, sourceBlock?: import('../db/StudyBlockService').StudyBlock, initialDuration?: number, onClose: () => void, onSaved: (block: import('../db/StudyBlockService').StudyBlock) => void }} props */
export default function ScheduleSheet({ userId, task, sourceBlock, initialDuration = 30, onClose, onSaved }) {
  const s = useThemedStyles(createStyles);
  const [window, setWindow] = useState(() => getInitialStudyWindow(new Date(), initialDuration));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(/** @type {{ days: import('../db/StudyLoadService').StudyLoad[], times: {start_time: string, end_time: string} } | null} */ (null));
  const submitting = useRef(false);

  /** @param {Partial<import('../utils/scheduling').StudyWindow>} change */
  function changeWindow(change) {
    setWindow(current => ({ ...current, ...change }));
    setError('');
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
      const times = proceed && warning ? warning.times : buildStudyTimes(window, new Date());
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
    <Sheet title={sourceBlock ? 'Reschedule session' : 'Schedule session'} kicker="STUDY SESSION" onClose={onClose} busy={busy}>
      <View style={s.task}><Text style={s.subject}>{task.subject_name}</Text><Text style={s.taskTitle}>{task.title}</Text></View>
      {warning ? (
        <View accessibilityRole="alert" style={s.warning}>
          <Text style={s.warningKicker}>WORKLOAD WARNING</Text>
          <Text style={s.warningTitle}>Daily study time exceeds 4 hours</Text>
          <Text style={s.warningBody}>This session would put your planned and completed study time above 4 hours.</Text>
          {warning.days.map(day => <Text key={day.date} style={s.warningDetail}>{day.date} · {formatMinutes(day.current_minutes)} already planned + {formatMinutes(day.added_minutes)} = {formatMinutes(day.total_minutes)}</Text>)}
          <Text style={s.warningBody}>Adjust the start or end time, or continue scheduling.</Text>
          <Message text={error} />
          <Button label="Schedule anyway" busy={busy} onPress={() => void submit(true)} />
          <View style={s.gap} /><Button label="Adjust session" tone="quiet" disabled={busy} onPress={() => { setWarning(null); setError(''); }} />
        </View>
      ) : (
        <>
          <Input label={`Start time · ${window.startDay}`} value={window.startTime} onChangeText={startTime => changeWindow({ startTime })}
            placeholder="18:00" keyboardType="numbers-and-punctuation" editable={!busy} autoCorrect={false} autoCapitalize="none" autoComplete="off" maxLength={16} />
          <View style={s.choices}>
            <Pill label="Start today" selected={window.startDay === 'today'} disabled={busy} onPress={() => changeWindow({ startDay: 'today' })} />
            <Pill label="Start tomorrow" selected={window.startDay === 'tomorrow'} disabled={busy} onPress={() => changeWindow({ startDay: 'tomorrow', endDay: 'tomorrow' })} />
          </View>
          <Input label={`End time · ${window.endDay}`} value={window.endTime} onChangeText={endTime => changeWindow({ endTime })}
            placeholder="19:00" keyboardType="numbers-and-punctuation" editable={!busy} autoCorrect={false} autoCapitalize="none" autoComplete="off" maxLength={16} returnKeyType="done" onSubmitEditing={() => void submit()} />
          <View style={s.choices}>
            <Pill label="End today" selected={window.endDay === 'today'} disabled={busy} onPress={() => changeWindow({ endDay: 'today' })} />
            <Pill label="End tomorrow" selected={window.endDay === 'tomorrow'} disabled={busy} onPress={() => changeWindow({ endDay: 'tomorrow' })} />
          </View>
          <Text style={s.help}>Use your local 24-hour clock (HH:mm). Choose a future start and a later end. For an overnight session, select End tomorrow.</Text>
          <Message text={error} />
          <Button label={sourceBlock ? 'Reschedule session ↗' : 'Save session'} busy={busy} onPress={() => void submit()} />
          <Text style={s.footnote}>Scheduled sessions appear in Home.</Text>
        </>
      )}
    </Sheet>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  task: { borderLeftWidth: 2, borderLeftColor: p.accent, paddingLeft: 16, marginBottom: 36 }, subject: { color: p.muted, fontSize: 12, marginBottom: 7 }, taskTitle: { color: p.text, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  help: { color: p.muted, fontSize: 12, lineHeight: 20, marginBottom: 28 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }, footnote: { color: p.muted, fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 26 },
  warning: { padding: 20, borderRadius: 20, backgroundColor: p.warmSoft, borderWidth: 1, borderColor: p.line }, warningKicker: { color: p.warm, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 20 },
  warningTitle: { color: p.text, fontSize: 25, lineHeight: 31, letterSpacing: -0.6, marginBottom: 20 }, warningBody: { color: p.text, fontSize: 14, lineHeight: 22, marginBottom: 24 }, warningDetail: { color: p.warm, fontSize: 12, lineHeight: 21, marginBottom: 20 }, gap: { height: 20 },
});
