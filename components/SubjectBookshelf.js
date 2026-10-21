import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** Choose readable ink for the user's stored dark-mode book color. @param {string} color */
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
  const { colors: p, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width + 12) / 112));
  const bookWidth = width ? (width - (columns - 1) * 12) / columns : '100%';
  return (
    <View style={s.shelf}>
      <View style={s.toolbar}>
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
          const ink = isDark ? bookInk(subject.color) : p.text;
          const rule = isDark ? (ink === '#000000' ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.35)') : p.line;
          return (
            <Pressable key={subject.id} accessibilityRole="button"
              accessibilityLabel={`${subject.name}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
              accessibilityHint={selected ? 'Show all subjects' : 'Filter tasks by this subject'}
              accessibilityState={{ selected, disabled }} disabled={disabled}
              onPress={() => onSelect(selected ? null : subject.id)}
              style={({ pressed }) => [s.bookFrame, { width: bookWidth }, selected && s.selected, pressed && s.pressed, disabled && s.disabled]}>
              <View style={[s.spine, !isDark && s.monochromeSpine, { backgroundColor: isDark ? subject.color : p.surface }]}>
                <View style={[s.binding, { backgroundColor: rule }]} />
                <View pointerEvents="none" style={s.coverShade} />
                <View pointerEvents="none" style={[s.pages, !isDark && s.monochromePages]}>
                  {Array.from({ length: 7 }, (_, line) => <View key={line} style={s.pageLine} />)}
                </View>
                <View pointerEvents="none" style={[s.bindingBand, { top: 8 }]}>
                  {[0, 1].map(line => <View key={line} style={[s.bindingRule, { backgroundColor: rule }]} />)}
                </View>
                <View style={[s.bookTop, { borderBottomColor: rule }]}>
                  <Text style={[s.number, { color: ink }]}>{String(index + 1).padStart(2, '0')}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'book-outline'} size={18} color={ink} />
                </View>
                <Text style={[s.name, { color: ink }]}>{subject.name}</Text>
                <View style={[s.bookBottom, { borderTopColor: rule }]}>
                  <Text style={[s.count, { color: ink }]}>{count} {count === 1 ? 'task' : 'tasks'}</Text>
                </View>
                <View pointerEvents="none" style={[s.bindingBand, { bottom: 7 }]}>
                  {[0, 1].map(line => <View key={line} style={[s.bindingRule, { backgroundColor: rule }]} />)}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={s.shelfEdge}><View style={s.shelfHighlight} /></View>
    </View>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  shelf: { backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 14, padding: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
  allButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  allSelected: { backgroundColor: p.accent, borderColor: p.accent }, allText: { color: p.text, fontSize: 12, fontWeight: '600' }, allSelectedText: { color: p.onAccent },
  books: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 },
  bookFrame: { borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 3 }, selected: { borderColor: p.text },
  spine: { flex: 1, minHeight: 212, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingTop: 24, paddingBottom: 22, paddingLeft: 16, paddingRight: 14, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)' },
  monochromeSpine: { borderWidth: 1, borderColor: p.line, borderBottomWidth: 4 },
  binding: { position: 'absolute', left: 5, top: 0, bottom: 0, width: 2 },
  coverShade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(0,0,0,0.12)' },
  bindingBand: { position: 'absolute', left: 12, right: 12, gap: 3 }, bindingRule: { height: 1 },
  pages: { position: 'absolute', right: 0, top: 10, bottom: 10, width: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.12)', backgroundColor: '#E8E3DA', justifyContent: 'space-evenly' },
  monochromePages: { backgroundColor: p.raised, borderLeftColor: p.line },
  pageLine: { height: 1, backgroundColor: 'rgba(0,0,0,0.2)', width: '100%' },
  bookTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, paddingBottom: 12 },
  number: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  name: { flexGrow: 1, fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2, marginTop: 20, marginBottom: 24 },
  bookBottom: { borderTopWidth: 1, paddingTop: 12 }, count: { fontSize: 11, lineHeight: 18, fontWeight: '600' },
  shelfEdge: { height: 10, marginTop: 16, borderRadius: 3, backgroundColor: p.raised, borderBottomWidth: 3, borderBottomColor: p.line },
  shelfHighlight: { height: 1, backgroundColor: p.muted, opacity: 0.25 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
