import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { selectCoachMessage } from '../utils/coaching';
import { useTimeFormat } from '../TimeFormatContext';
import { createStudyStyles } from './studyStyles';
import { fonts, typeScale, typeLeading } from './typography';

/** @param {{tasks: import('../db/TaskService').Task[], scheduledMinutes: number,
 * history: import('../db/CoachService').CoachHistory, now: number}} props */
function CoachCard({ tasks, scheduledMinutes, history, now }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles), c = useThemedStyles(createStyles);
  const { formatTime } = useTimeFormat();
  const note = useMemo(() => {
    const hour = new Date(now); hour.setHours(history?.bestHour ?? 0, 0, 0, 0);
    return selectCoachMessage({ tasks, scheduledMinutes, history, bestHourLabel: formatTime(hour), now });
  }, [tasks, scheduledMinutes, history, now, formatTime]);
  if (!note) return null;
  return <View style={[s.card, c.note]}>
    <View style={c.heading}><Ionicons name="leaf-outline" size={20} color={p.accent} /><Text style={s.sectionTitle}>Coach</Text></View>
    <Text style={c.message}>{note.message}</Text>
  </View>;
}

export default memo(CoachCard);

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  note: { backgroundColor: p.hero, borderColor: p.heroLine, borderLeftWidth: 3, borderLeftColor: p.accent },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  message: { fontFamily: fonts.body, fontSize: typeScale.body, lineHeight: typeLeading.body, color: p.text },
});
