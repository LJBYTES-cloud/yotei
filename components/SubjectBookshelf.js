import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../ThemeContext';
import { fieldGradient } from '../utils/subjectFields';

/** @param {{subject: import('../db/SubjectService').Subject, count: number, selected: boolean, revealed: boolean, disabled: boolean, reduceMotion: boolean, onReveal: () => void, onReturn: () => void, onSelect: () => void, onEdit: () => void}} props */
function SubjectBook({ subject, count, selected, revealed, disabled, reduceMotion, onReveal, onReturn, onSelect, onEdit }) {
  const s = useThemedStyles(createStyles);
  const [progress] = useState(() => new Animated.Value(revealed ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) { progress.setValue(revealed ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: revealed ? 1 : 0, duration: 260, useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [progress, revealed, reduceMotion]);
  const colors = fieldGradient(subject.field_colors);
  const details = <>
    <View pointerEvents="none" style={s.binding} />
    <View pointerEvents="none" style={s.coverShade} />
    <View pointerEvents="none" style={s.pages}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={s.pageLine} />)}</View>
    <View pointerEvents="none" style={[s.bindingBand, { top: 14 }]}><View style={s.bindingRule} /><View style={s.bindingRule} /></View>
    <View pointerEvents="none" style={[s.bindingBand, { bottom: 14 }]}><View style={s.bindingRule} /><View style={s.bindingRule} /></View>
  </>;
  return (
    <Animated.View style={[s.bookFrame, selected && s.selected, disabled && s.disabled, { width: progress.interpolate({ inputRange: [0, 1], outputRange: [64, 232] }) }]}>
      {revealed ? <Animated.View style={{ transform: [{ perspective: 800 }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cover}>
          {details}
          <View style={s.coverTools}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Return ${subject.subject_code} to shelf`} disabled={disabled} onPress={onReturn} style={s.tool}>
              <Ionicons name="chevron-back" size={19} color="#111111" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${subject.name}`} accessibilityHint="Edit subject name, code, field of study, and colors" accessibilityState={{ disabled }} disabled={disabled} onPress={onEdit} style={s.tool}>
              <Ionicons name="pencil-outline" size={18} color="#111111" />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${subject.name}, ${subject.subject_code}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
            accessibilityHint={selected ? 'Show all tasks' : 'Filter tasks by this subject'} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onSelect}
            style={({ pressed }) => [s.coverBody, pressed && s.pressed]}>
            <View style={s.coverLabel}>
              <Text style={s.code}>{subject.subject_code}</Text>
              <Text style={s.name}>{subject.name}</Text>
              <View style={s.coverBottom}><Text style={s.count}>{count} {count === 1 ? 'task' : 'tasks'}</Text><Ionicons name={selected ? 'checkmark-circle' : 'book-outline'} size={20} color="#111111" /></View>
              {selected && <Text style={s.selectionText}>Selected</Text>}
            </View>
          </Pressable>
        </LinearGradient>
      </Animated.View> : <Pressable accessibilityRole="button" accessibilityLabel={`Reveal ${subject.subject_code}, ${subject.name}`}
        accessibilityHint="Pull the book off the shelf to reveal its cover" accessibilityState={{ selected, expanded: false, disabled }} disabled={disabled} onPress={onReveal}
        style={({ pressed }) => pressed && s.pressed}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.spine}>
          {details}
          <Text style={s.spineCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{subject.subject_code}</Text>
          {selected && <View style={s.spineSelected}><Ionicons name="checkmark-circle" size={18} color="#111111" /></View>}
        </LinearGradient>
      </Pressable>}
    </Animated.View>
  );
}

/** Horizontal shelves grouped by field. Revealing a cover never changes the task filter.
 * @param {{subjects: import('../db/SubjectService').Subject[], taskCounts: Map<number, number>, selectedId: number | null, disabled?: boolean, onSelect: (id: number | null) => void, onEdit: (subject: import('../db/SubjectService').Subject) => void}} props
 */
export default function SubjectBookshelf({ subjects, taskCounts, selectedId, disabled = false, onSelect, onEdit }) {
  const s = useThemedStyles(createStyles);
  const [revealedId, setRevealedId] = useState(/** @type {number | null} */ (null));
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (mounted) setReduceMotion(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !changed) setReduceMotion(value); }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);
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
  return <View style={s.shelves}>
    <View style={s.toolbar}><Pressable accessibilityRole="button" accessibilityLabel="Show All Tasks" accessibilityState={{ selected: selectedId === null, disabled }} disabled={disabled}
      onPress={() => { onSelect(null); setRevealedId(null); }} style={({ pressed }) => [s.allButton, selectedId === null && s.allSelected, pressed && s.pressed]}>
      <Text style={[s.allText, selectedId === null && s.allSelectedText]}>Show All Tasks</Text>
    </Pressable></View>
    {groups.map(group => <View key={group.key} style={s.shelf}>
      <Text style={s.fieldTitle}>{group.name}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.books} keyboardShouldPersistTaps="handled">
        {group.subjects.map(subject => <SubjectBook key={subject.id} subject={subject} count={taskCounts.get(subject.id) ?? 0}
          selected={subject.id === selectedId} revealed={subject.id === revealedId} disabled={disabled} reduceMotion={reduceMotion}
          onReveal={() => setRevealedId(subject.id)} onReturn={() => setRevealedId(null)}
          onSelect={() => onSelect(subject.id === selectedId ? null : subject.id)} onEdit={() => onEdit(subject)} />)}
      </ScrollView>
      <View style={s.shelfEdge}><View style={s.shelfHighlight} /></View>
    </View>)}
  </View>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  shelves: { gap: 24 }, shelf: { backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 14, padding: 12 },
  fieldTitle: { color: p.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  allButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  allSelected: { backgroundColor: p.accent, borderColor: p.accent }, allText: { color: p.text, fontSize: 12, fontWeight: '600' }, allSelectedText: { color: p.onAccent },
  books: { alignItems: 'flex-end', gap: 8, paddingTop: 14, paddingBottom: 8, paddingRight: 8 },
  bookFrame: { flexShrink: 0, borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 3, paddingTop: 8, overflow: 'hidden' },
  selected: { borderColor: p.accent },
  spine: { width: 54, minHeight: 280, alignItems: 'center', justifyContent: 'center', borderRadius: 5, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.2)' },
  spineCode: { width: 216, textAlign: 'center', transform: [{ rotate: '90deg' }], backgroundColor: '#FAF7F0', color: '#111111', paddingVertical: 6, paddingHorizontal: 8, fontSize: 17, lineHeight: 24, letterSpacing: 1.3, fontWeight: '700' },
  spineSelected: { position: 'absolute', bottom: 32, backgroundColor: '#FAF7F0', borderRadius: 12, padding: 2 },
  cover: { width: 222, minHeight: 280, borderRadius: 7, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.2)' },
  coverTools: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 22 },
  tool: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#FAF7F0', borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  coverBody: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  coverLabel: { backgroundColor: '#FAF7F0', borderRadius: 4, padding: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  code: { color: '#111111', fontSize: 11, lineHeight: 18, fontWeight: '700', letterSpacing: 1.2 },
  name: { color: '#111111', fontSize: 19, lineHeight: 27, fontWeight: '700', marginTop: 16, marginBottom: 24 },
  coverBottom: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.25)', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { color: '#111111', fontSize: 12, lineHeight: 20, fontWeight: '600' }, selectionText: { color: '#111111', fontSize: 11, fontWeight: '700', marginTop: 10 },
  binding: { position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.3)' },
  coverShade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(0,0,0,0.12)' },
  bindingBand: { position: 'absolute', left: 10, right: 10, gap: 3 }, bindingRule: { height: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  pages: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 5, backgroundColor: '#E8E3DA', justifyContent: 'space-evenly' }, pageLine: { height: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  shelfEdge: { height: 10, marginTop: 12, borderRadius: 3, backgroundColor: p.raised, borderBottomWidth: 3, borderBottomColor: p.line }, shelfHighlight: { height: 1, backgroundColor: p.muted, opacity: 0.25 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
