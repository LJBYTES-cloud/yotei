import { fonts, typeScale, typeLeading } from './typography';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { FieldLabel, Message } from './ui';
import { useTimeFormat } from '../TimeFormatContext';

/** @param {{label: string, help: string, value: Date, disabled?: boolean, minimumDate: Date, onChange: (value: Date, part: 'date' | 'time') => void}} props */
export default function DateTimeField({ label, help, value, disabled = false, minimumDate, onChange }) {
  const { colors: p, isDark } = useTheme();
  const { is24Hour, formatTime } = useTimeFormat();
  const s = useThemedStyles(createStyles);
  const [error, setError] = useState('');
  const [timeExpanded, setTimeExpanded] = useState(false);
  const active = useRef(/** @type {'date' | 'time' | null} */ (null));
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (active.current) void DateTimePickerAndroid.dismiss(active.current).catch(() => {});
    };
  }, []);
  /** @param {'date' | 'time'} mode */
  function open(mode) {
    if (disabled || active.current || Platform.OS !== 'android') return;
    active.current = mode;
    setError('');
    try {
      DateTimePickerAndroid.open({ value, mode, is24Hour,
        ...(mode === 'date' ? { minimumDate } : {}),
        onValueChange: (_event, picked) => { active.current = null; if (mounted.current) onChange(picked, mode); },
        onDismiss: () => { active.current = null; },
        onError: () => { active.current = null; if (mounted.current) setError('Could not open the picker. Try again.'); },
      });
    } catch { active.current = null; setError('Could not open the picker. Try again.'); }
  }
  return <View style={s.field}>
    <FieldLabel label={label} help={help} />
    {Platform.OS === 'ios' ? <View style={s.iosControls}>
      <DateTimePicker value={value} mode="date" display="compact" minimumDate={minimumDate} disabled={disabled}
        themeVariant={isDark ? 'dark' : 'light'} accentColor={p.accent} accessibilityLabel={`${label} date`}
        onValueChange={(_event, picked) => onChange(picked, 'date')} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} time: ${formatTime(value)}`} accessibilityState={{ expanded: timeExpanded }} disabled={disabled}
        onPress={() => setTimeExpanded(current => !current)} style={s.timeButton}><Ionicons name="time-outline" size={18} color={p.muted} /><Text style={s.value}>{formatTime(value)}</Text></Pressable>
      {timeExpanded && <DateTimePicker value={value} mode="time" display="spinner" disabled={disabled} locale={is24Hour ? 'en-GB' : 'en-US'} style={{ width: '100%', height: 180 }}
        themeVariant={isDark ? 'dark' : 'light'} textColor={p.text} accentColor={p.accent} accessibilityLabel={`${label} time`}
        onValueChange={(_event, picked) => onChange(picked, 'time')} />}
    </View> : <View style={s.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} date: ${value.toLocaleDateString()}`}
        disabled={disabled || Platform.OS !== 'android'} onPress={() => open('date')}
        style={({ pressed }) => [s.dateButton, pressed && s.pressed, disabled && s.disabled]}>
        <Ionicons name="calendar-outline" size={18} color={p.muted} />
        <Text style={s.value}>{value.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} time: ${formatTime(value)}`}
        disabled={disabled || Platform.OS !== 'android'} onPress={() => open('time')}
        style={({ pressed }) => [s.timeButton, pressed && s.pressed, disabled && s.disabled]}>
        <Ionicons name="time-outline" size={18} color={p.muted} />
        <Text style={s.value}>{formatTime(value)}</Text>
      </Pressable>
    </View>}
    <Message text={error} />
  </View>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  field: { marginBottom: 24 }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateButton: { flexGrow: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 12 },
  timeButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 12 },
  value: { fontFamily: fonts.semibold, color: p.text, fontSize: typeScale.body, lineHeight: typeLeading.body, fontWeight: 'normal', flexShrink: 1, fontVariant: ['tabular-nums'] },
  iosControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: p.input, borderRadius: 12, borderWidth: 1, borderColor: p.line },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
});
