import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemedStyles } from '../ThemeContext';

/** Choose readable ink for the user's stored book color in either theme. @param {string} color */
function bookInk(color) {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

/**
 * A wrapping shelf inside the Library's virtualized task list header.
 * @param {{subjects: import('../db/SubjectService').Subject[], taskCounts: Map<number, number>, selectedId: number | null, disabled?: boolean, onSelect: (id: number | null) => void}} props
 */
export default function SubjectBookshelf({ subjects, taskCounts, selectedId, disabled = false, onSelect }) {
  const s = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width + 16) / 116));
  const bookWidth = width ? (width - (columns - 1) * 16) / columns : '100%';
  return (
    <View>
      <View style={s.toolbar}>
        <Text style={s.help}>Tap a subject to show its tasks.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Show tasks from all subjects"
          accessibilityState={{ selected: selectedId === null, disabled }} disabled={disabled} onPress={() => onSelect(null)}
          style={({ pressed }) => [s.allButton, selectedId === null && s.allSelected, pressed && s.pressed]}>
          <Text style={[s.allText, selectedId === null && s.allSelectedText]}>Show all</Text>
        </Pressable>
      </View>
      <View style={s.books} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {subjects.map((subject, index) => {
          const selected = subject.id === selectedId;
          const count = taskCounts.get(subject.id) ?? 0;
          const ink = bookInk(subject.color);
          const rule = ink === '#000000' ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.35)';
          return (
            <Pressable key={subject.id} accessibilityRole="button"
              accessibilityLabel={`${subject.name}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
              accessibilityHint={selected ? 'Show all subjects' : 'Filter tasks by this subject'}
              accessibilityState={{ selected, disabled }} disabled={disabled}
              onPress={() => onSelect(selected ? null : subject.id)}
              style={({ pressed }) => [s.bookFrame, { width: bookWidth }, selected && s.selected, pressed && s.pressed, disabled && s.disabled]}>
              {/* Stored colors are intentional here, including in light mode. */}
              <View style={[s.spine, { backgroundColor: subject.color }]}>
                <View style={[s.binding, { backgroundColor: rule }]} />
                <View style={[s.bookTop, { borderBottomColor: rule }]}>
                  <Text style={[s.number, { color: ink }]}>{String(index + 1).padStart(2, '0')}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'book-outline'} size={18} color={ink} />
                </View>
                <Text numberOfLines={4} style={[s.name, { color: ink }]}>{subject.name}</Text>
                <View style={[s.bookBottom, { borderTopColor: rule }]}>
                  <Text style={[s.count, { color: ink }]}>{count} {count === 1 ? 'task' : 'tasks'}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={s.shelfEdge} />
    </View>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  help: { flex: 1, minWidth: 130, color: p.muted, fontSize: 12, lineHeight: 20 },
  allButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  allSelected: { backgroundColor: p.accent, borderColor: p.accent }, allText: { color: p.text, fontSize: 12, fontWeight: '600' }, allSelectedText: { color: p.onAccent },
  books: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 16 },
  bookFrame: { borderWidth: 2, borderColor: 'transparent', borderRadius: 12, padding: 4 }, selected: { borderColor: p.text },
  spine: { flex: 1, minHeight: 192, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingTop: 16, paddingBottom: 14, paddingLeft: 20, paddingRight: 12, overflow: 'hidden' },
  binding: { position: 'absolute', left: 7, top: 0, bottom: 0, width: 2 },
  bookTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, paddingBottom: 12 },
  number: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  name: { flexGrow: 1, fontSize: 17, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3, marginTop: 24, marginBottom: 24 },
  bookBottom: { borderTopWidth: 1, paddingTop: 12 }, count: { fontSize: 11, lineHeight: 18, fontWeight: '600' },
  shelfEdge: { height: 6, marginTop: 12, borderRadius: 3, backgroundColor: p.line },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
