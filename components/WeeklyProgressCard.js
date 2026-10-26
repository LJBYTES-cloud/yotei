import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { createStudyStyles } from './studyStyles';
import { fonts, typeScale, typeLeading } from './typography';
import { InfoButton } from './ui';
import ProgressDetailsModal from './ProgressDetailsModal';

/** @param {string} date */
const localDay = date => new Date(`${date}T12:00:00`);
/** @param {number} value */
const minuteLabel = value => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** @param {{userId: string, days: import('../db/ProgressService').StudyProgressDay[], ready: boolean, error?: string}} props */
export default function WeeklyProgressCard({ userId, days, ready, error = '' }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const w = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);
  const [selectedDate, setSelectedDate] = useState(/** @type {string | null} */ (null));
  const pointPress = useRef(false);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const summary = days.map(day => `${localDay(day.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${minuteLabel(day.minutes)} minutes`).join('; ');
  return <View style={s.card}>
    <View style={s.section}><Text style={s.sectionTitle}>Weekly Progress</Text>
      <InfoButton title="Weekly Progress" message="Completed study minutes over the last seven local dates, including today. Timer sessions use actual study time; older untimed completions use scheduled duration. Each session counts on its completion date." />
    </View>
    {ready && <Text style={w.total}>{minuteLabel(total)} min completed · last 7 days</Text>}
    <View style={w.plot} onLayout={event => {
      const next = Math.floor(event.nativeEvent.layout.width);
      if (Number.isFinite(next) && next > 0) setWidth(current => current === next ? current : next);
    }}>
      {!ready ? error ? <Text style={w.detail}>Progress unavailable. Pull to refresh.</Text> : <ActivityIndicator color={p.accent} accessibilityLabel="Loading weekly progress" />
        : width > 0 && days.length === 7 ? <Pressable accessibilityRole="button" accessibilityLabel={`Open Weekly Summary. ${summary}`}
          onStartShouldSetResponderCapture={() => { pointPress.current = false; return false; }}
          onPress={() => { if (!pointPress.current) setSelectedDate('week'); }}>
          <LineChart width={width} height={220} fromZero fromNumber={1}
            data={{ labels: days.map(day => localDay(day.date).toLocaleDateString(undefined, { weekday: 'short' })), datasets: [{ data: days.map(day => day.minutes) }] }}
            chartConfig={{ backgroundColor: p.background, backgroundGradientFrom: p.background, backgroundGradientTo: p.background,
              backgroundGradientFromOpacity: 1, backgroundGradientToOpacity: 1,
              color: () => p.accent, labelColor: () => p.muted, strokeWidth: 2, decimalPlaces: 0,
              propsForLabels: { fontFamily: fonts.body, fontSize: typeScale.small },
              propsForDots: { r: '4', strokeWidth: '2', stroke: p.background },
            }}
            withShadow={false} withInnerLines={false} withOuterLines={false} withHorizontalLines={false} withVerticalLines={false}
            yLabelsOffset={8} style={{ borderRadius: 12, paddingRight: 40, paddingTop: 20 }}
            onDataPointClick={({ index }) => { if (days[index]) { pointPress.current = true; setSelectedDate(days[index].date); } }} />
        </Pressable> : null}
    </View>
    {ready && <Text style={w.detail}>Completed Study Minutes</Text>}
    {selectedDate && <ProgressDetailsModal key={`${userId}-${selectedDate}`} userId={userId} days={days} selection={selectedDate} onDay={setSelectedDate} onClose={() => setSelectedDate(null)} />}
  </View>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  total: { fontFamily: fonts.medium, fontSize: typeScale.body, lineHeight: typeLeading.body, color: p.text, marginBottom: 16 },
  plot: { minHeight: 220, backgroundColor: p.background, borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
  detail: { fontFamily: fonts.body, fontSize: typeScale.small, lineHeight: typeLeading.small, color: p.muted, marginTop: 12 },
});
