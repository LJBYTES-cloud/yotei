import { fonts, typeScale, typeLeading } from './typography';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { bookGradient } from '../utils/subjectFields';

/** @param {{subject: import('../db/SubjectService').Subject, count: number, revealed: boolean, disabled: boolean, reduceMotion: boolean, onReveal: () => void, onReturn: () => void, onOpen: () => void, onEdit: () => void}} props */
function SubjectBook({ subject, count, revealed, disabled, reduceMotion, onReveal, onReturn, onOpen, onEdit }) {
  const s = useThemedStyles(createStyles);
  const { colors: p, isDark } = useTheme();
  const [progress] = useState(() => new Animated.Value(revealed ? 1 : 0));
  const [coverHeight, setCoverHeight] = useState(280);
  useEffect(() => {
    if (reduceMotion) { progress.setValue(revealed ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: revealed ? 1 : 0, duration: 260, useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [progress, revealed, reduceMotion]);
  const colors = bookGradient(subject.field_colors, isDark ? p.background : null);
  const details = <>
    <View pointerEvents="none" style={s.binding} />
    <View pointerEvents="none" style={s.coverShade} />
    <View pointerEvents="none" style={s.pages}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={s.pageLine} />)}</View>
    <View pointerEvents="none" style={[s.bindingBand, { top: 14 }]}><View style={s.bindingRule} /><View style={s.bindingRule} /></View>
    <View pointerEvents="none" style={[s.bindingBand, { bottom: 14 }]}><View style={s.bindingRule} /><View style={s.bindingRule} /></View>
  </>;
  return (
    <Animated.View style={[s.bookFrame, revealed && s.revealedFrame, disabled && s.disabled, {
      width: progress.interpolate({ inputRange: [0, 1], outputRange: [64, 232] }),
      height: progress.interpolate({ inputRange: [0, 1], outputRange: [295, coverHeight + 15] }),
    }]}>
      <Animated.View pointerEvents={revealed ? 'auto' : 'none'} accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
        style={[s.layer, { opacity: progress, transform: [{ perspective: 800 }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cover}
          onLayout={event => { const height = Math.max(280, Math.ceil(event.nativeEvent.layout.height)); setCoverHeight(current => current === height ? current : height); }}>
          {details}
          <View style={s.coverTools}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Close ${subject.subject_code}`} disabled={disabled || !revealed} onPress={onReturn} style={s.tool}>
              <Ionicons name="chevron-back" size={18} color={p.bookInk} /><Text style={s.closeLabel}>Close</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${subject.name}`} accessibilityHint="Edit subject name, code, field of study, and colors" accessibilityState={{ disabled: disabled || !revealed }} disabled={disabled || !revealed} onPress={onEdit} style={s.tool}>
              <Ionicons name="pencil-outline" size={18} color={p.bookInk} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${subject.name}, ${subject.subject_code}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
            accessibilityHint="Open this subject's task notebook" accessibilityState={{ expanded: revealed, disabled: disabled || !revealed }} disabled={disabled || !revealed} onPress={onOpen}
            style={({ pressed }) => [s.coverBody, pressed && s.pressed]}>
            <View style={s.coverLabel}>
              <Text style={s.code}>{subject.subject_code}</Text>
              <Text style={s.name}>{subject.name}</Text>
              <View style={s.coverBottom}><Text style={s.count}>{count} {count === 1 ? 'task' : 'tasks'}</Text><Ionicons name="book-outline" size={20} color={p.bookInk} /></View>
            </View>
          </Pressable>
        </LinearGradient>
      </Animated.View>
      <Animated.View pointerEvents={revealed ? 'none' : 'auto'} accessibilityElementsHidden={revealed} importantForAccessibility={revealed ? 'no-hide-descendants' : 'auto'}
        style={[s.layer, { opacity: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] }) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Reveal ${subject.subject_code}, ${subject.name}`}
        accessibilityHint="Pull the book off the shelf to reveal its cover" accessibilityState={{ expanded: false, disabled: disabled || revealed }} disabled={disabled || revealed} onPress={onReveal}
        style={({ pressed }) => pressed && s.pressed}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.spine}>
          {details}
          <Text style={s.spineCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{subject.subject_code}</Text>
        </LinearGradient>
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/** Horizontal shelves grouped by field. A cover opens a dedicated subject notebook.
 * @param {{subjects: import('../db/SubjectService').Subject[], taskCounts: Map<number, number>, disabled?: boolean, onOpen: (subject: import('../db/SubjectService').Subject) => void, onEdit: (subject: import('../db/SubjectService').Subject) => void, onAddField: (field: string) => void}} props
 */
export default function SubjectBookshelf({ subjects, taskCounts, disabled = false, onOpen, onEdit, onAddField }) {
  const s = useThemedStyles(createStyles);
  const { colors: p } = useTheme();
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
    {groups.map(group => <View key={group.key} style={s.shelf}>
      <View style={s.shelfHeading}><Text style={s.fieldTitle}>{group.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Add Subject to ${group.name}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAddField(group.name)} style={({ pressed }) => [s.addSubject, pressed && s.pressed]}>
          <Ionicons name="add" size={22} color={p.accent} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.books} keyboardShouldPersistTaps="handled">
        {group.subjects.map(subject => <SubjectBook key={subject.id} subject={subject} count={taskCounts.get(subject.id) ?? 0}
          revealed={subject.id === revealedId} disabled={disabled} reduceMotion={reduceMotion}
          onReveal={() => setRevealedId(subject.id)} onReturn={() => setRevealedId(null)}
          onOpen={() => onOpen(subject)} onEdit={() => onEdit(subject)} />)}
      </ScrollView>
      <View style={s.shelfEdge}><View style={s.shelfHighlight} /></View>
    </View>)}
  </View>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  shelves: { gap: 24 }, shelf: { backgroundColor: p.input, borderWidth: 1, borderColor: p.line, borderRadius: 14, padding: 12 },
  shelfHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  fieldTitle: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal', flex: 1 },
  addSubject: { width: 44, height: 44, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, alignItems: 'center', justifyContent: 'center' },
  books: { alignItems: 'flex-end', gap: 8, paddingTop: 14, paddingBottom: 8, paddingRight: 8 },
  bookFrame: { flexShrink: 0, borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 3, paddingTop: 8, overflow: 'hidden' },
  layer: { position: 'absolute', left: 3, top: 8 },
  revealedFrame: { borderColor: p.accent },
  spine: { width: 54, minHeight: 280, alignItems: 'center', justifyContent: 'center', borderRadius: 5, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.2)' },
  spineCode: { fontFamily: fonts.bold, width: 216, textAlign: 'center', transform: [{ rotate: '90deg' }], backgroundColor: p.bookPaper, color: p.bookInk, paddingVertical: 6, paddingHorizontal: 8, fontSize: typeScale.h3, lineHeight: typeLeading.h3, letterSpacing: 1.3, fontWeight: 'normal' },
  cover: { width: 222, minHeight: 280, borderRadius: 7, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.2)' },
  coverTools: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 22 },
  tool: { minWidth: 44, minHeight: 44, flexDirection: 'row', gap: 2, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: p.bookPaper, borderWidth: 1, borderColor: p.bookRule },
  closeLabel: { fontFamily: fonts.medium, color: p.bookInk, fontSize: typeScale.small, lineHeight: typeLeading.small },
  coverBody: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  coverLabel: { backgroundColor: p.bookPaper, borderRadius: 4, padding: 14, borderWidth: 1, borderColor: p.bookRule },
  code: { fontFamily: fonts.bold, color: p.bookInk, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', letterSpacing: 1.2 },
  name: { fontFamily: fonts.serifBold, color: p.bookInk, fontSize: typeScale.h2, lineHeight: typeLeading.h2, fontWeight: 'normal', marginTop: 16, marginBottom: 24 },
  coverBottom: { borderTopWidth: 1, borderTopColor: p.bookRule, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { fontFamily: fonts.semibold, color: p.bookInk, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal' },
  binding: { position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.3)' },
  coverShade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(0,0,0,0.12)' },
  bindingBand: { position: 'absolute', left: 10, right: 10, gap: 3 }, bindingRule: { height: 1, backgroundColor: p.bookRule },
  pages: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 5, backgroundColor: p.bookPages, justifyContent: 'space-evenly' }, pageLine: { height: 1, backgroundColor: p.bookRule },
  shelfEdge: { height: 10, marginTop: 12, borderRadius: 3, backgroundColor: p.raised, borderBottomWidth: 3, borderBottomColor: p.line }, shelfHighlight: { height: 1, backgroundColor: p.muted, opacity: 0.25 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
