import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { USE_REAL_AUTH } from '../auth';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, Message } from '../components/ui';

export default function SettingsScreen() {
  const { user, blocked, disabled, seeding, loadDemoData, signOut, signingOut, signOutError } = useStudy();
  const { colors: p, isDark, toggleTheme } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const t = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Settings" edition="MAKE IT YOURS" eyebrow="YOUR SPACE, YOUR PACE" subtitle="A few thoughtful choices for the way you like to study." />
        <View style={[s.card, t.profile]}><View style={t.avatar}><Text style={t.initial}>{user.name.charAt(0).toUpperCase() || 'Y'}</Text></View><View style={s.flex}><Text style={t.name}>{user.name}</Text><Text style={s.hint}>{user.email}</Text></View></View>
        <Text style={t.label}>01 / APPEARANCE</Text>
        <View style={s.card}>
          <View style={t.row}><View style={s.flex}><Text style={t.title}>Light mode</Text><Text style={t.description}>{isDark ? 'After hours. A little violet.' : 'Paper, ink, and room to think.'}</Text></View>
            <Switch accessibilityLabel="Light mode" accessibilityHint="Switch between dark purple and monochrome light themes" value={!isDark} onValueChange={toggleTheme} trackColor={{ false: p.line, true: p.accent }} thumbColor={isDark ? p.muted : p.surface} ios_backgroundColor={p.line} />
          </View>
          <View style={t.themePreview}><View style={t.previewPage}><View style={t.previewLine} /><View style={[t.previewLine, t.shortLine]} /><View style={t.previewButton} /></View><View style={s.flex}><Text style={s.eyebrow}>{isDark ? 'DARK / VIOLET' : 'LIGHT / MONOCHROME'}</Text><Text style={s.hint}>Same intention. A different atmosphere.</Text></View></View>
        </View>
        <Feedback />
        {!USE_REAL_AUTH && <>
          <Text style={t.label}>02 / TAKE A LOOK AROUND</Text>
          <View style={s.card}><Text style={t.title}>A day, already in motion.</Text><Text style={t.body}>Three subjects, six small steps, and four hours of focus. Explore coaching and the workload check-in.</Text><Button label="Load Demo Data" tone="outline" disabled={disabled || blocked} busy={seeding} onPress={() => void loadDemoData()} /><Text style={t.footnote}>Replaces only this demo account’s local study data.</Text></View>
        </>}
        <Text style={t.label}>{USE_REAL_AUTH ? '02' : '03'} / YOUR ACCOUNT</Text>
        <View style={s.card}><Text style={t.title}>Until next time.</Text><Text style={t.body}>Your study plans will be here when you return.</Text><Message text={signOutError} /><Button label="Sign Out ↗" busy={signingOut} disabled={blocked} onPress={signOut} /></View>
        <Text style={s.footer}>YOTEI / A LITTLE MORE INTENTION.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }, initial: { color: p.accent, fontSize: 23, fontWeight: '500' }, name: { color: p.text, fontSize: 18, fontWeight: '500', marginBottom: 4 },
  label: { color: p.muted, fontSize: 10, letterSpacing: 1.7, fontWeight: '700', marginTop: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, title: { color: p.text, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  description: { color: p.muted, fontSize: 12, lineHeight: 20, marginTop: 6 }, body: { color: p.muted, fontSize: 14, lineHeight: 23, marginTop: 12, marginBottom: 24 },
  footnote: { color: p.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  themePreview: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: p.line },
  previewPage: { height: 80, width: 62, borderRadius: 8, borderWidth: 1, borderColor: p.line, backgroundColor: p.background, padding: 10, gap: 6 },
  previewLine: { height: 3, borderRadius: 2, backgroundColor: p.text, marginTop: 4 }, shortLine: { width: '65%', backgroundColor: p.muted, marginTop: 0 }, previewButton: { height: 14, borderRadius: 4, backgroundColor: p.accent, marginTop: 12 },
});
