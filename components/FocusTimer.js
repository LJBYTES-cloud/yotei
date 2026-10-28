import { fonts, typeScale, typeLeading } from './typography';
import { memo, useCallback, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { formatElapsed, getFocusTiming } from '../utils/focusTimer';
import { useStudy } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { Button } from './ui';

/** @param {{block: import('../db/StudyBlockService').StudyBlock}} props */
function FocusTimer({ block }) {
  const { disabled, workingBlock, workingTimerAction, controlTimer, complete } = useStudy();
  const { subjectColor } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const t = useThemedStyles(createStyles);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    let interval = /** @type {ReturnType<typeof setInterval> | null} */ (null);
    const tick = () => setNow(Date.now());
    const sync = (/** @type {import('react-native').AppStateStatus | null} */ state) => {
      if (interval !== null) clearInterval(interval);
      interval = null;
      if (state === 'active' || state === null) { tick(); interval = setInterval(tick, 1000); }
    };
    sync(AppState.currentState);
    const subscription = AppState.addEventListener('change', sync);
    return () => { if (interval !== null) clearInterval(interval); subscription.remove(); };
  }, []));
  const timing = getFocusTiming(block, now);
  const onBreak = block.break_started_at !== null;
  const working = workingBlock === block.id;
  return <View style={[s.card, t.card]}>
    <View style={s.cardTop}><View style={[s.dot, { backgroundColor: subjectColor(block.subject_color) }]} /><Text style={s.subject}>{block.subject_name}</Text>
      <Text style={[s.badge, s.activeBadge]}>{onBreak ? 'On Break' : 'Active'}</Text></View>
    <Text style={s.title}>{block.task_title}</Text>
    <View style={t.clock}>
      <Text style={t.label}>{onBreak ? 'Break' : 'Work'}</Text>
      <Text style={t.elapsed} accessibilityLabel={`${onBreak ? 'Break' : 'Work'} time ${formatElapsed(onBreak ? timing.currentBreakSeconds : timing.workSeconds)}`}>
        {formatElapsed(onBreak ? timing.currentBreakSeconds : timing.workSeconds)}</Text>
      <Text style={s.hint}>{onBreak ? `${formatElapsed(timing.workSeconds)} studied · work paused` : 'elapsed'}</Text>
    </View>
    <Text style={t.breakTotal}>Total Breaks: {formatElapsed(timing.breakSeconds)}</Text>
    <View style={t.actions}>
      <Button label={onBreak ? 'Resume Work' : 'Take Break'} disabled={disabled} busy={working && workingTimerAction !== 'finish'}
        onPress={() => void controlTimer(block.id, onBreak ? 'resume' : 'break')} />
      <Button label="Finish Session" tone="outline" disabled={disabled} busy={working && workingTimerAction === 'finish'} onPress={() => void complete(block.id)} />
    </View>
  </View>;
}

export default memo(FocusTimer);

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  card: { borderColor: p.accent },
  clock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  label: { fontFamily: fonts.bold, color: p.accent, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', letterSpacing: 1.4 },
  elapsed: { fontFamily: fonts.bold, color: p.text, fontSize: typeScale.metric, lineHeight: typeLeading.metric, fontWeight: 'normal', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  breakTotal: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, textAlign: 'center', marginBottom: 24 }, actions: { gap: 16 },
});
