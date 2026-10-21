import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../ThemeContext';
import { fieldGradient } from '../utils/subjectFields';

/**
 * Horizontal shelves grouped by field inside Library's task list header.
 * @param {{subjects: import('../db/SubjectService').Subject[], taskCounts: Map<number, number>, selectedId: number | null, disabled?: boolean, onSelect: (id: number | null) => void}} props
 */
export default function SubjectBookshelf({ subjects, taskCounts, selectedId, disabled = false, onSelect }) {
  const s = useThemedStyles(createStyles);
  const groups = useMemo(() => {
    const fields = new Map(/** @type {[string, {name: string, subjects: import('../db/SubjectService').Subject[]}][]} */ ([]));
    for (const subject of subjects) {
      const key = subject.field_of_study.toLowerCase();
      const group = fields.get(key);
      if (group) group.subjects.push(subject);
      else fields.set(key, { name: subject.field_of_study, subjects: [subject] });
    }
    return Array.from(fields, ([key, value]) => ({ key, ...value }));
  }, [subjects]);
  return (
    <View style={s.shelves}>
      <View style={s.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Show tasks from all subjects"
          accessibilityState={{ selected: selectedId === null, disabled }} disabled={disabled} onPress={() => onSelect(null)}
          style={({ pressed }) => [s.allButton, selectedId === null && s.allSelected, pressed && s.pressed]}>
          <Text style={[s.allText, selectedId === null && s.allSelectedText]}>Show all</Text>
        </Pressable>
      </View>
      {groups.map(group => <View key={group.key} style={s.shelf}>
      <Text style={s.fieldTitle}>{group.name}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.books} keyboardShouldPersistTaps="handled">
        {group.subjects.map((subject, index) => {
          const selected = subject.id === selectedId;
          const count = taskCounts.get(subject.id) ?? 0;
          const rule = 'rgba(0,0,0,0.3)';
          return (
            <Pressable key={subject.id} accessibilityRole="button"
              accessibilityLabel={`${subject.name}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
              accessibilityHint={selected ? 'Show all subjects' : 'Filter tasks by this subject'}
              accessibilityState={{ selected, disabled }} disabled={disabled}
              onPress={() => onSelect(selected ? null : subject.id)}
              style={({ pressed }) => [s.bookFrame, selected && s.selected, pressed && s.pressed, disabled && s.disabled]}>
              <LinearGradient colors={fieldGradient(subject.field_colors)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.spine}>
                <View style={[s.binding, { backgroundColor: rule }]} />
                <View pointerEvents="none" style={s.coverShade} />
                <View pointerEvents="none" style={s.pages}>
                  {Array.from({ length: 7 }, (_, line) => <View key={line} style={s.pageLine} />)}
                </View>
                <View pointerEvents="none" style={[s.bindingBand, { top: 8 }]}>
                  {[0, 1].map(line => <View key={line} style={[s.bindingRule, { backgroundColor: rule }]} />)}
                </View>
                <View style={s.bookLabel}>
                <View style={[s.bookTop, { borderBottomColor: rule }]}>
                  <Text style={s.number}>{String(index + 1).padStart(2, '0')}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'book-outline'} size={18} color="#111111" />
                </View>
                <Text style={s.name}>{subject.name}</Text>
                <View style={[s.bookBottom, { borderTopColor: rule }]}>
                  <Text style={s.count}>{count} {count === 1 ? 'task' : 'tasks'}</Text>
                </View>
                </View>
                <View pointerEvents="none" style={[s.bindingBand, { bottom: 7 }]}>
                  {[0, 1].map(line => <View key={line} style={[s.bindingRule, { backgroundColor: rule }]} />)}
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.shelfEdge}><View style={s.shelfHighlight} /></View>
      </View>)}
    </View>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  shelves: { gap: 24 },
  shelf: { backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 14, padding: 12 },
  fieldTitle: { color: p.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 16 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  allButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  allSelected: { backgroundColor: p.accent, borderColor: p.accent }, allText: { color: p.text, fontSize: 12, fontWeight: '600' }, allSelectedText: { color: p.onAccent },
  books: { alignItems: 'flex-end', gap: 12, paddingBottom: 8 },
  bookFrame: { width: 156, flexShrink: 0, borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 3 }, selected: { borderColor: p.text },
  // Natural content height keeps long titles and scaled text out of flex clipping.
  spine: { minHeight: 248, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingTop: 24, paddingBottom: 24, paddingLeft: 16, paddingRight: 14, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)' },
  bookLabel: { backgroundColor: '#FAF7F0', borderRadius: 3, padding: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  binding: { position: 'absolute', left: 5, top: 0, bottom: 0, width: 2 },
  coverShade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(0,0,0,0.12)' },
  bindingBand: { position: 'absolute', left: 12, right: 12, gap: 3 }, bindingRule: { height: 1 },
  pages: { position: 'absolute', right: 0, top: 10, bottom: 10, width: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.12)', backgroundColor: '#E8E3DA', justifyContent: 'space-evenly' },
  pageLine: { height: 1, backgroundColor: 'rgba(0,0,0,0.2)', width: '100%' },
  bookTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, paddingBottom: 12 },
  number: { color: '#111111', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  name: { color: '#111111', fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2, marginTop: 16, marginBottom: 20 },
  bookBottom: { borderTopWidth: 1, paddingTop: 12 }, count: { color: '#111111', fontSize: 11, lineHeight: 18, fontWeight: '600' },
  shelfEdge: { height: 10, marginTop: 16, borderRadius: 3, backgroundColor: p.raised, borderBottomWidth: 3, borderBottomColor: p.line },
  shelfHighlight: { height: 1, backgroundColor: p.muted, opacity: 0.25 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
